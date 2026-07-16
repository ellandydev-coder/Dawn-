// src/audio/graph/MasterLimiter.ts

import {
  DEFAULT_MASTER_CONFIG,
  LIMITER_PARAM_TIME,
  clampHeadroom,
  getMasterErrorMessage,
} from './master.types';

export interface MasterLimiterConfig {
  headroomDb?: number;
  limiterRelease?: number;
  limiterAttack?: number;
  limiterRatio?: number;
  limiterKnee?: number;
  verbose?: boolean;
}

export interface MasterLimiterCallbacks {
  /** Devuelve el nodo output del BusNode para reconectar paths */
  getOutput(): GainNode;
  /** Devuelve el destination actual (si hay uno) */
  getDestination(): AudioNode | null;
  /** Log del padre */
  log(msg: string, level?: 'info' | 'warn' | 'error'): void;
}

/**
 * MasterLimiter
 * -------------
 * Gestiona el ciclo de vida completo del limiter del MasterBus:
 * - Crear el DynamicsCompressorNode nativo
 * - Insertar / retirar del signal path (output → limiter → destination)
 * - Cambiar headroom / threshold en runtime
 * - Aceptar un limiter custom (AudioWorkletNode futuro)
 *
 * NO conoce BusNode internamente — se comunica via callbacks.
 */
export class MasterLimiter {
  private readonly _ctx: AudioContext;
  private readonly _callbacks: MasterLimiterCallbacks;

  private _defaultLimiter: DynamicsCompressorNode | null = null;
  private _customLimiter: AudioNode | null = null;
  private _activeLimiter: AudioNode | null = null;

  private _enabled: boolean;
  private _headroomDb: number;
  private readonly _release: number;
  private readonly _attack: number;
  private readonly _ratio: number;
  private readonly _knee: number;

  constructor(
    ctx: AudioContext,
    callbacks: MasterLimiterCallbacks,
    config: MasterLimiterConfig = {}
  ) {
    this._ctx = ctx;
    this._callbacks = callbacks;

    this._enabled = false;
    this._headroomDb = clampHeadroom(
      config.headroomDb ?? DEFAULT_MASTER_CONFIG.headroomDb
    );
    this._release = config.limiterRelease ?? DEFAULT_MASTER_CONFIG.limiterRelease;
    this._attack = config.limiterAttack ?? DEFAULT_MASTER_CONFIG.limiterAttack;
    this._ratio = config.limiterRatio ?? DEFAULT_MASTER_CONFIG.limiterRatio;
    this._knee = config.limiterKnee ?? DEFAULT_MASTER_CONFIG.limiterKnee;

    this._createDefaultLimiter();
  }

  // ═══════════════════════════════════════════
  // Creación interna
  // ═══════════════════════════════════════════

  private _createDefaultLimiter(): void {
    try {
      const compressor = this._ctx.createDynamicsCompressor();
      compressor.threshold.value = this._computeThresholdDb();
      compressor.knee.value = this._knee;
      compressor.ratio.value = this._ratio;
      compressor.attack.value = this._attack;
      compressor.release.value = this._release;
      this._defaultLimiter = compressor;
    } catch (err) {
      this._callbacks.log(
        `No se pudo crear DynamicsCompressor: ${getMasterErrorMessage(err)}. ` +
        `MasterBus funcionará sin limiter.`,
        'warn'
      );
      this._defaultLimiter = null;
    }
  }

  // ═══════════════════════════════════════════
  // Inserción / remoción del signal path
  // ═══════════════════════════════════════════

  private _insertLimiter(limiter: AudioNode | null): void {
    if (!limiter) {
      this._activeLimiter = null;
      return;
    }

    this._removeLimiter();
    this._activeLimiter = limiter;

    const output = this._callbacks.getOutput();
    const destination = this._callbacks.getDestination();

    if (destination) {
      try { output.disconnect(destination); } catch { /* ignore */ }

      output.connect(limiter);

      try {
        limiter.connect(destination);
      } catch (err) {
        this._callbacks.log(
          `Error conectando limiter → destination: ${getMasterErrorMessage(err)}`,
          'error'
        );
      }
    } else {
      output.connect(limiter);
    }
  }

  private _removeLimiter(): void {
    if (!this._activeLimiter) return;

    const oldLimiter = this._activeLimiter;
    this._activeLimiter = null;

    const output = this._callbacks.getOutput();
    const destination = this._callbacks.getDestination();

    try { output.disconnect(oldLimiter); } catch { /* ignore */ }

    if (destination) {
      try { oldLimiter.disconnect(destination); } catch { /* ignore */ }
      try { output.connect(destination); } catch (err) {
        this._callbacks.log(
          `Error restaurando conexión directa: ${getMasterErrorMessage(err)}`,
          'error'
        );
      }
    }
  }

  // ═══════════════════════════════════════════
  // API pública
  // ═══════════════════════════════════════════

  public setEnabled(enabled: boolean): void {
    if (this._enabled === enabled) return;
    this._enabled = enabled;

    if (enabled) {
      const limiterToUse = this._customLimiter ?? this._defaultLimiter;
      if (limiterToUse) {
        this._insertLimiter(limiterToUse);
      } else {
        this._callbacks.log(
          'Limiter enable pedido pero no hay limiter disponible',
          'warn'
        );
      }
    } else {
      this._removeLimiter();
    }
  }

  public isEnabled(): boolean {
    return this._enabled;
  }

  public setHeadroom(db: number): number {
    const clamped = clampHeadroom(db);
    if (this._headroomDb === clamped) return clamped;

    this._headroomDb = clamped;
    const newThreshold = this._computeThresholdDb();

    if (this._defaultLimiter) {
      try {
        this._defaultLimiter.threshold.setTargetAtTime(
          newThreshold,
          this._ctx.currentTime,
          LIMITER_PARAM_TIME
        );
      } catch (err) {
        this._callbacks.log(
          `Error actualizando threshold: ${getMasterErrorMessage(err)}`,
          'warn'
        );
      }
    }

    return clamped;
  }

  public getHeadroom(): number {
    return this._headroomDb;
  }

  public getThresholdDb(): number {
    return this._computeThresholdDb();
  }

  public setCustomLimiter(node: AudioNode | null): void {
    if (this._customLimiter === node) return;

    const wasEnabled = this._enabled;
    if (wasEnabled) this._removeLimiter();

    this._customLimiter = node;

    if (wasEnabled) {
      const limiterToUse = node ?? this._defaultLimiter;
      if (limiterToUse) this._insertLimiter(limiterToUse);
    }
  }

  public getActiveLimiter(): AudioNode | null {
    return this._activeLimiter;
  }

  public hasCustomLimiter(): boolean {
    return this._customLimiter !== null;
  }

  public getGainReductionDb(): number {
    if (
      !this._activeLimiter ||
      this._activeLimiter !== this._defaultLimiter ||
      !this._defaultLimiter
    ) {
      return 0;
    }
    return this._defaultLimiter.reduction;
  }

  /** Llamar cuando se conecta un nuevo destination, para reinsertar el limiter */
  public onDestinationConnected(destination: AudioNode): void {
    if (!this._activeLimiter) return;
    try {
      this._activeLimiter.connect(destination);
    } catch (err) {
      this._callbacks.log(
        `Error conectando limiter → destination: ${getMasterErrorMessage(err)}`,
        'error'
      );
    }
  }

  /** Llamar justo antes de desconectar un destination */
  public onDestinationDisconnecting(destination: AudioNode): void {
    if (!this._activeLimiter) return;
    try { this._activeLimiter.disconnect(destination); } catch { /* ignore */ }
  }

  public dispose(): void {
    this._removeLimiter();

    if (this._defaultLimiter) {
      try { this._defaultLimiter.disconnect(); } catch { /* ignore */ }
      this._defaultLimiter = null;
    }

    this._customLimiter = null;
    this._activeLimiter = null;
  }

  // ═══════════════════════════════════════════
  // Internos
  // ═══════════════════════════════════════════

  private _computeThresholdDb(): number {
    return this._headroomDb;
  }
}