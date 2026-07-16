// src/audio/graph/MasterBus.ts

import { BusNode } from './BusNode';
import { MasterLimiter } from './MasterLimiter';
import {
  type MasterBusConfig,
  type MasterBusStats,
  type MasterBusEvent,
  type MasterBusListener,
  DEFAULT_MASTER_CONFIG,
  clampHeadroom,
  getMasterErrorMessage,
} from './master.types';

export type { MasterBusConfig, MasterBusStats, MasterBusEvent, MasterBusListener };

/**
 * MasterBus
 * ---------
 * Bus master REAPER-style. Extiende `BusNode` con:
 *
 * - Limiter integrado (via MasterLimiter)
 * - Headroom configurable
 * - Conexión restringida: solo connectToDestination()
 * - No puede ser source de send (loop garantizado)
 * - Meter siempre presente
 * - kind fijo: 'master'
 *
 * Signal path:
 *   input → trim → [FX] → panner → panLaw → gain → muteGate → output
 *                                                                  │
 *                                                            [limiter?]
 *                                                                  │
 *                                                           ctx.destination
 */
export class MasterBus extends BusNode {
  private readonly _limiter: MasterLimiter;
  private _destinationNode: AudioNode | null = null;
  private readonly _masterListeners = new Set<MasterBusListener>();

  constructor(id: string, ctx: AudioContext, config: MasterBusConfig = {}) {
    super(id, ctx, {
      ...config,
      kind: 'master',
      attachMeter: true,
    });

    const headroomDb = clampHeadroom(
      config.headroomDb ?? DEFAULT_MASTER_CONFIG.headroomDb
    );

    this._limiter = new MasterLimiter(
      ctx,
      {
        getOutput: () => this.output,
        getDestination: () => this._destinationNode,
        log: (msg, level) => this._logMaster(msg, level),
      },
      {
        headroomDb,
        limiterRelease: config.limiterRelease,
        limiterAttack: config.limiterAttack,
        limiterRatio: config.limiterRatio,
        limiterKnee: config.limiterKnee,
      }
    );

    if (config.limiterEnabled ?? DEFAULT_MASTER_CONFIG.limiterEnabled) {
      this._limiter.setEnabled(true);
    }

    this._logMaster(
      `Creado (limiter=${this._limiter.isEnabled() ? 'ON' : 'OFF'}, ` +
      `headroom=${headroomDb}dB)`
    );
  }

  // ═══════════════════════════════════════════
  // Limiter — API pública
  // ═══════════════════════════════════════════

  public setLimiterEnabled(enabled: boolean): void {
    if (this.isDisposed) return;
    if (this._limiter.isEnabled() === enabled) return;

    this._limiter.setEnabled(enabled);
    this._emitMaster({ type: 'limiterEnabledChanged', enabled });
    this._logMaster(`Limiter → ${enabled ? 'ON' : 'OFF'}`);
  }

  public isLimiterEnabled(): boolean {
    return this._limiter.isEnabled();
  }

  public setHeadroom(db: number): void {
    if (this.isDisposed) return;
    const clamped = this._limiter.setHeadroom(db);
    if (clamped === this._limiter.getHeadroom() && db === clamped) return;

    this._emitMaster({
      type: 'headroomChanged',
      headroomDb: clamped,
      thresholdDb: this._limiter.getThresholdDb(),
    });
  }

  public getHeadroom(): number {
    return this._limiter.getHeadroom();
  }

  public setCustomLimiter(node: AudioNode | null): void {
    if (this.isDisposed) return;
    if (this._limiter.hasCustomLimiter() && node === this._limiter.getActiveLimiter()) return;

    this._limiter.setCustomLimiter(node);

    if (node) {
      this._emitMaster({ type: 'customLimiterAttached', node });
      this._logMaster('Custom limiter conectado');
    } else {
      this._emitMaster({ type: 'customLimiterDetached' });
      this._logMaster('Custom limiter desconectado (usando default)');
    }
  }

  public getActiveLimiter(): AudioNode | null {
    return this._limiter.getActiveLimiter();
  }

  public hasCustomLimiter(): boolean {
    return this._limiter.hasCustomLimiter();
  }

  public getGainReductionDb(): number {
    return this._limiter.getGainReductionDb();
  }

  // ═══════════════════════════════════════════
  // Conexión a destination
  // ═══════════════════════════════════════════

  public override connect(_destination: AudioNode): void {
    throw new Error(
      `[MasterBus:${this.id}] Usa connectToDestination() en vez de connect(). ` +
      `MasterBus solo puede conectarse a un destino final (typ. ctx.destination).`
    );
  }

  public connectToDestination(destination: AudioNode): void {
    if (this.isDisposed) throw new Error(`[MasterBus:${this.id}] Ya fue disposed`);
    if (this._destinationNode === destination) return;

    if (this._destinationNode) {
      this.disconnectFromDestination();
    }

    this._destinationNode = destination;

    if (this._limiter.getActiveLimiter()) {
      this._limiter.onDestinationConnected(destination);
    } else {
      try {
        this.output.connect(destination);
      } catch (err) {
        this._logMaster(
          `Error conectando output → destination: ${getMasterErrorMessage(err)}`,
          'error'
        );
        this._destinationNode = null;
        throw err;
      }
    }

    this._emitMaster({ type: 'connectedToDestination' });
    this._logMaster('Conectado a destination');
  }

  public disconnectFromDestination(): void {
    if (this.isDisposed) return;
    if (!this._destinationNode) return;

    const dest = this._destinationNode;

    if (this._limiter.getActiveLimiter()) {
      this._limiter.onDestinationDisconnecting(dest);
    } else {
      try { this.output.disconnect(dest); } catch { /* ignore */ }
    }

    this._destinationNode = null;
    this._emitMaster({ type: 'disconnectedFromDestination' });
    this._logMaster('Desconectado de destination');
  }

  public override disconnect(destination?: AudioNode): void {
    if (destination && destination !== this._destinationNode) {
      this._logMaster(
        'disconnect() con destination que no coincide — ignorado',
        'warn'
      );
      return;
    }
    this.disconnectFromDestination();
  }

  public isConnectedToDestination(): boolean {
    return this._destinationNode !== null;
  }

  public getDestination(): AudioNode | null {
    return this._destinationNode;
  }

  // ═══════════════════════════════════════════
  // Overrides bloqueantes
  // ═══════════════════════════════════════════

  public override getSendSource(_preFader: boolean): AudioNode {
    throw new Error(
      `[MasterBus:${this.id}] MasterBus no puede ser source de un send ` +
      `(loop garantizado).`
    );
  }

  public override panic(): void {
    if (this.isDisposed) return;
    super.panic();
    this._logMaster('MASTER PANIC — salida cortada', 'warn');
  }

  // ═══════════════════════════════════════════
  // Eventos propios
  // ═══════════════════════════════════════════

  public onMasterEvent(listener: MasterBusListener): () => void {
    this._masterListeners.add(listener);
    return () => { this._masterListeners.delete(listener); };
  }

  private _emitMaster(event: MasterBusEvent): void {
    const snapshot = Array.from(this._masterListeners);
    for (const listener of snapshot) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[MasterBus:${this.id}] Error en listener:`, err);
      }
    }
  }

  // ═══════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════

  public override getStats(): MasterBusStats {
    return {
      ...super.getStats(),
      limiterEnabled: this._limiter.isEnabled(),
      headroomDb: this._limiter.getHeadroom(),
      thresholdDb: this._limiter.getThresholdDb(),
      gainReductionDb: this._limiter.getGainReductionDb(),
      isCustomLimiter: this._limiter.hasCustomLimiter(),
      isConnectedToDestination: this._destinationNode !== null,
    };
  }

  // ═══════════════════════════════════════════
  // Dispose
  // ═══════════════════════════════════════════

  public override dispose(): void {
    if (this.isDisposed) return;

    try {
      if (this._destinationNode) {
        this.disconnectFromDestination();
      }
      this._limiter.dispose();
      this._masterListeners.clear();
    } catch (err) {
      this._logMaster(`Error en dispose: ${getMasterErrorMessage(err)}`, 'error');
    }

    super.dispose();
  }

  // ═══════════════════════════════════════════
  // Internos
  // ═══════════════════════════════════════════

  private _logMaster(
    msg: string,
    level: 'info' | 'warn' | 'error' = 'info'
  ): void {
    const prefix = `[MasterBus:${this.id}]`;
    switch (level) {
      case 'error': console.error(prefix, msg); break;
      case 'warn':  console.warn(prefix, msg);  break;
      default:
        if (import.meta.env?.DEV) console.info(prefix, msg);
    }
  }
}