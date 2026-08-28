// src/audio/graph/TrackAudioNode.ts

import { MeterManager } from '@audio/metering/MeterManager';
import { EffectChain } from '@audio/worklets/processors/EffectChain';

/**
 * TrackAudioNode
 * --------------
 * Encapsula los AudioNodes de una pista individual.
 *
 * Cadena de señal:
 * ```
 *   input → trim → panner → gain → [fxChain] → phaseInvert → output (bus/master)
 *                                        │
 *                                        └──► meter (rama paralela, post-gain)
 * ```
 */

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface TrackAudioNodeConfig {
  volume?: number;
  pan?: number;
  fadeTime?: number;
  verbose?: boolean;
}

export interface TrackAudioNodeStats {
  id: string;
  volume: number;
  pan: number;
  trim: number;
  muted: boolean;
  phaseInverted: boolean;
  hasMeter: boolean;
  fxInsertCount: number;
  isDisposed: boolean;
}

export type TrackAudioNodeEvent =
  | { type: 'volumeChanged'; volume: number }
  | { type: 'panChanged'; pan: number }
  | { type: 'trimChanged'; trim: number }
  | { type: 'muteChanged'; muted: boolean }
  | { type: 'phaseChanged'; inverted: boolean }
  | { type: 'fxChainChanged'; insertCount: number }
  | { type: 'connected'; destination: AudioNode }
  | { type: 'disconnected' }
  | { type: 'disposed' };

export type TrackAudioNodeListener = (event: TrackAudioNodeEvent) => void;

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: Required<TrackAudioNodeConfig> = {
  volume: 0.8,
  pan: 0,
  fadeTime: 0.01,
  verbose: import.meta.env?.DEV ?? false,
};

// ═══════════════════════════════════════════════════════════════
// 🎯 CLASE
// ═══════════════════════════════════════════════════════════════

export class TrackAudioNode {
  public readonly id: string;

  private _ctx: AudioContext;
  private _config: Required<TrackAudioNodeConfig>;

  // Nodos de la cadena
  private _input: GainNode;
  private _trim: GainNode;
  private _panner: StereoPannerNode;
  private _gain: GainNode;
  private _phaseInvert: GainNode;
  private _meter: AudioWorkletNode | null = null;

  // ── FX Chain (NUEVO) ──
  private _fxChain: EffectChain | null = null;

  // Estado
  private _volume: number;
  private _pan: number;
  private _trimGain = 1;
  private _muted = false;
  private _phaseInverted = false;
  private _isDisposed = false;

  private _listeners = new Set<TrackAudioNodeListener>();

  constructor(id: string, ctx: AudioContext, config: TrackAudioNodeConfig = {}) {
    this.id = id;
    this._ctx = ctx;
    this._config = { ...DEFAULT_CONFIG, ...config };

    this._volume = this._config.volume;
    this._pan = this._config.pan;

    // Crear nodos
    this._input = ctx.createGain();
    this._trim = ctx.createGain();
    this._panner = ctx.createStereoPanner();
    this._gain = ctx.createGain();
    this._phaseInvert = ctx.createGain();

    // Valores iniciales
    this._trim.gain.value = this._trimGain;
    this._panner.pan.value = this._pan;
    this._gain.gain.value = this._volume;
    this._phaseInvert.gain.value = 1;

    // Conectar cadena principal (sin FX por ahora)
    this._input.connect(this._trim);
    this._trim.connect(this._panner);
    this._panner.connect(this._gain);
    this._gain.connect(this._phaseInvert);

    // Meter en rama paralela
    this._attachMeter();

    this._log(`Creada`);
  }

  // ─────────────────────────────────────────────
  // FX Chain (NUEVO)
  // ─────────────────────────────────────────────

  /**
   * Inicializa la cadena de efectos para esta track.
   * Reconecta: gain → fxChain.input → fxChain.output → phaseInvert
   *
   * Debe llamarse una vez, típicamente cuando se añade el primer plugin.
   */
  public initFxChain(): EffectChain {
    if (this._fxChain) return this._fxChain;

    this._fxChain = new EffectChain(this.id, this._ctx);

    // Reconectar: gain → fx → phaseInvert
    try { this._gain.disconnect(); } catch { /* */ }
    this._gain.connect(this._fxChain.input);
    this._fxChain.output.connect(this._phaseInvert);

    this._log(`FX chain inicializada`);
    this._emit({ type: 'fxChainChanged', insertCount: 0 });

    return this._fxChain;
  }

  /** Devuelve la EffectChain si existe, o null */
  public getFxChain(): EffectChain | null {
    return this._fxChain;
  }

  /**
   * Añade un insert VST3 a la cadena de efectos.
   * Crea la FX chain si no existe.
   */
  public async addFxInsert(
    pluginKey: string,
    instanceId: string,
    sampleRate?: number,
    maxBlockSize?: number
  ): Promise<boolean> {
    const chain = this._fxChain ?? this.initFxChain();
    const sr = sampleRate ?? this._ctx.sampleRate;
    const success = await chain.addInsert(
      pluginKey,
      instanceId,
      sr,
      maxBlockSize
    );

    if (success) {
      this._emit({
        type: 'fxChainChanged',
        insertCount: chain.insertCount,
      });
    }

    return success;
  }

  // ─────────────────────────────────────────────
  // Meter
  // ─────────────────────────────────────────────

  private _attachMeter(): void {
    try {
      this._meter = MeterManager.createMeter(this.id, this._ctx);
      this._gain.connect(this._meter);
    } catch (err) {
      this._log(`Meter no disponible: ${err}`, 'warn');
      this._meter = null;
    }
  }

  public getMeterNode(): AudioWorkletNode | null {
    return this._meter;
  }

  // ─────────────────────────────────────────────
  // Conexión / desconexión
  // ─────────────────────────────────────────────

  public connect(destination: AudioNode): void {
    this._assertNotDisposed();
    this._phaseInvert.connect(destination);
    this._emit({ type: 'connected', destination });
  }

  public disconnect(): void {
    if (this._isDisposed) return;
    try {
      this._phaseInvert.disconnect();
      this._emit({ type: 'disconnected' });
    } catch (err) {
      this._log(`Error al desconectar: ${err}`, 'warn');
    }
  }

  public get input(): GainNode {
    this._assertNotDisposed();
    return this._input;
  }

  // ─────────────────────────────────────────────
  // Volumen principal
  // ─────────────────────────────────────────────

  public setVolume(value: number): void {
    if (this._isDisposed) return;
    const clamped = Math.max(0, Math.min(1, value));
    if (this._volume === clamped) return;
    this._volume = clamped;
    if (!this._muted) {
      this._gain.gain.setTargetAtTime(
        clamped, this._ctx.currentTime, this._config.fadeTime
      );
    }
    this._emit({ type: 'volumeChanged', volume: clamped });
  }

  public getVolume(): number { return this._volume; }

  // ─────────────────────────────────────────────
  // Trim
  // ─────────────────────────────────────────────

  public setTrim(value: number): void {
    if (this._isDisposed) return;
    const clamped = Math.max(0, Math.min(4, value));
    if (this._trimGain === clamped) return;
    this._trimGain = clamped;
    this._trim.gain.setTargetAtTime(
      clamped, this._ctx.currentTime, this._config.fadeTime
    );
    this._emit({ type: 'trimChanged', trim: clamped });
  }

  public getTrim(): number { return this._trimGain; }

  // ─────────────────────────────────────────────
  // Pan
  // ─────────────────────────────────────────────

  public setPan(value: number): void {
    if (this._isDisposed) return;
    const clamped = Math.max(-1, Math.min(1, value));
    if (this._pan === clamped) return;
    this._pan = clamped;
    this._panner.pan.setTargetAtTime(
      clamped, this._ctx.currentTime, this._config.fadeTime
    );
    this._emit({ type: 'panChanged', pan: clamped });
  }

  public getPan(): number { return this._pan; }

  // ─────────────────────────────────────────────
  // Mute
  // ─────────────────────────────────────────────

  public setMuted(muted: boolean): void {
    if (this._isDisposed) return;
    if (this._muted === muted) return;
    this._muted = muted;
    const target = muted ? 0 : this._volume;
    this._gain.gain.setTargetAtTime(
      target, this._ctx.currentTime, this._config.fadeTime
    );
    this._emit({ type: 'muteChanged', muted });
  }

  public isMuted(): boolean { return this._muted; }

  // ─────────────────────────────────────────────
  // Phase invert
  // ─────────────────────────────────────────────

  public setPhaseInvert(inverted: boolean): void {
    if (this._isDisposed) return;
    if (this._phaseInverted === inverted) return;
    this._phaseInverted = inverted;
    this._phaseInvert.gain.setValueAtTime(
      inverted ? -1 : 1, this._ctx.currentTime
    );
    this._emit({ type: 'phaseChanged', inverted });
  }

  public isPhaseInverted(): boolean { return this._phaseInverted; }

  // ─────────────────────────────────────────────
  // Send taps
  // ─────────────────────────────────────────────

  public getSendSource(preFader: boolean): AudioNode {
    this._assertNotDisposed();
    return preFader ? this._panner : this._gain;
  }

  // ─────────────────────────────────────────────
  // Eventos
  // ─────────────────────────────────────────────

  public on(listener: TrackAudioNodeListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _emit(event: TrackAudioNodeEvent): void {
    this._listeners.forEach((listener) => {
      try { listener(event); } catch (err) {
        console.error(`[TrackAudioNode:${this.id}] Error en listener:`, err);
      }
    });
  }

  // ─────────────────────────────────────────────
  // Stats
  // ─────────────────────────────────────────────

  public getStats(): TrackAudioNodeStats {
    return {
      id: this.id,
      volume: this._volume,
      pan: this._pan,
      trim: this._trimGain,
      muted: this._muted,
      phaseInverted: this._phaseInverted,
      hasMeter: this._meter !== null,
      fxInsertCount: this._fxChain?.insertCount ?? 0,
      isDisposed: this._isDisposed,
    };
  }

  public get isDisposed(): boolean { return this._isDisposed; }
  public get context(): AudioContext { return this._ctx; }

  // ─────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────

  public dispose(): void {
    if (this._isDisposed) return;
    try {
      try { this._phaseInvert.disconnect(); } catch { /* */ }
      try { this._gain.disconnect(); } catch { /* */ }
      try { this._panner.disconnect(); } catch { /* */ }
      try { this._trim.disconnect(); } catch { /* */ }
      try { this._input.disconnect(); } catch { /* */ }

      // FX chain
      if (this._fxChain) {
        this._fxChain.dispose();
        this._fxChain = null;
      }

      // Meter
      if (this._meter) {
        try { this._meter.disconnect(); } catch { /* */ }
        MeterManager.removeMeter(this.id);
        this._meter = null;
      }

      this._isDisposed = true;
      this._emit({ type: 'disposed' });
      this._listeners.clear();
      this._log(`Disposed`);
    } catch (err) {
      this._log(`Error en dispose: ${err}`, 'error');
    }
  }

  // ─────────────────────────────────────────────
  // Internos
  // ─────────────────────────────────────────────

  private _assertNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error(`[TrackAudioNode:${this.id}] Ya fue disposed`);
    }
  }

  private _log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this._config.verbose && level === 'info') return;
    const prefix = `[TrackAudioNode:${this.id}]`;
    switch (level) {
      case 'error': console.error(prefix, msg); break;
      case 'warn':  console.warn(prefix, msg);  break;
      default:      console.info(prefix, msg);
    }
  }
}