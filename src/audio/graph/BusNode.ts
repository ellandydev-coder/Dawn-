// src/audio/graph/BusNode.ts

import { panLawCenterGain } from '@domain/enums/PanLaw';
import type { PanLaw } from '@domain/enums/PanLaw';
import { type IEffectChain } from './IEffectChain';
import { BusMeter } from './BusMeter';
import {
  type BusKind,
  type BusNodeConfig,
  type BusNodeStats,
  type BusNodeEvent,
  type BusNodeListener,
  BUS_DEFAULT_CONFIG,
  BUS_VOLUME_MIN,
  BUS_VOLUME_MAX,
  BUS_PAN_MIN,
  BUS_PAN_MAX,
  BUS_TRIM_MIN,
  BUS_TRIM_MAX,
  BUS_MUTE_FADE_TIME,
  clampBusValue,
  getBusErrorMessage,
} from './bus.types';

export type { BusKind, BusNodeConfig, BusNodeStats, BusNodeEvent, BusNodeListener };
export type { IEffectChain };

/**
 * BusNode
 * -------
 * Nodo de bus REAPER-style para agrupar y procesar señales.
 *
 * Signal path:
 *   input → trim → [insertFX] → panner → panLawGain → gain → muteGate → output
 *                                                       │
 *                                                       ├─► meter (post-fader)
 *                                                       └─► send taps (pre/post)
 *
 * Características REAPER-style:
 * - Sends pre-fader O post-fader (tap points públicos)
 * - Insert FX chain con passthrough si no hay cadena
 * - Pan law aplicado explícitamente (compensación de ganancia)
 * - Meter siempre POST-gain para reflejar lo que suena
 * - Mute al final: sends siguen activos aunque el bus esté muted
 * - panic() corta inmediatamente sin fade
 *
 * NO se guarda en Redux (no serializable). Vive solo en el motor.
 */
export class BusNode {
  public readonly id: string;
  public readonly kind: BusKind;

  private readonly _ctx: AudioContext;
  private readonly _config: Required<BusNodeConfig>;

  // ── Nodos de la cadena (orden = signal flow) ─────────────
  private readonly _input: GainNode;
  private readonly _trim: GainNode;
  private readonly _panner: StereoPannerNode;
  private readonly _panLawGain: GainNode;
  private readonly _gain: GainNode;
  private readonly _muteGate: GainNode;
  private readonly _output: GainNode;

  // ── Opcionales ───────────────────────────────────────────
  private readonly _busMeter: BusMeter;
  private _effectChain: IEffectChain | null = null;

  // ── Estado interno ───────────────────────────────────────
  private _volume: number;
  private _pan: number;
  private _trimValue: number;
  private _muted: boolean;
  private _panLaw: PanLaw;
  private _meterPostFader: boolean;
  private _isDisposed = false;

  // ── Conexiones aguas abajo ───────────────────────────────
  private readonly _connections = new Set<AudioNode>();

  // ── Eventos ──────────────────────────────────────────────
  private readonly _listeners = new Set<BusNodeListener>();

  constructor(id: string, ctx: AudioContext, config: BusNodeConfig = {}) {
    if (!id || typeof id !== 'string') {
      throw new Error('[BusNode] id inválido');
    }

    this.id = id;
    this._ctx = ctx;
    this._config = { ...BUS_DEFAULT_CONFIG, ...config };
    this.kind = this._config.kind;

    this._volume = clampBusValue(this._config.volume, BUS_VOLUME_MIN, BUS_VOLUME_MAX);
    this._pan = clampBusValue(this._config.pan, BUS_PAN_MIN, BUS_PAN_MAX);
    this._trimValue = clampBusValue(this._config.trim, BUS_TRIM_MIN, BUS_TRIM_MAX);
    this._muted = this._config.muted;
    this._panLaw = this._config.panLaw;
    this._meterPostFader = this._config.meterPostFader;

    // ── Crear nodos ────────────────────────────────────────
    this._input = ctx.createGain();
    this._trim = ctx.createGain();
    this._panner = ctx.createStereoPanner();
    this._panLawGain = ctx.createGain();
    this._gain = ctx.createGain();
    this._muteGate = ctx.createGain();
    this._output = ctx.createGain();

    // ── Valores iniciales ──────────────────────────────────
    this._input.gain.value = 1;
    this._trim.gain.value = this._trimValue;
    this._panner.pan.value = this._pan;
    this._panLawGain.gain.value = panLawCenterGain(this._panLaw);
    this._gain.gain.value = this._volume;
    this._muteGate.gain.value = this._muted ? 0 : 1;
    this._output.gain.value = 1;

    // ── Conectar cadena principal ──────────────────────────
    this._input.connect(this._trim);
    this._connectAfterTrim();

    // ── Meter ──────────────────────────────────────────────
    this._busMeter = new BusMeter(id, ctx, {
      attach: this._config.attachMeter,
      verbose: this._config.verbose,
    });
    this._connectMeterToTap();

    this._log(`Creado (kind=${this.kind})`);
  }

  // ═══════════════════════════════════════════
  // Cadena interna
  // ═══════════════════════════════════════════

  private _connectAfterTrim(): void {
    try { this._trim.disconnect(); } catch { /* ignore */ }

    if (this._effectChain) {
      this._trim.connect(this._effectChain.inputNode);
      this._effectChain.outputNode.connect(this._panner);
    } else {
      this._trim.connect(this._panner);
    }

    this._ensureFixedChainConnected();
  }

  private _ensureFixedChainConnected(): void {
    try { this._panner.disconnect(this._panLawGain); } catch { /* ignore */ }
    try { this._panLawGain.disconnect(this._gain); } catch { /* ignore */ }
    try { this._gain.disconnect(this._muteGate); } catch { /* ignore */ }
    try { this._muteGate.disconnect(this._output); } catch { /* ignore */ }

    this._panner.connect(this._panLawGain);
    this._panLawGain.connect(this._gain);
    this._gain.connect(this._muteGate);
    this._muteGate.connect(this._output);
  }

  // ═══════════════════════════════════════════
  // Meter
  // ═══════════════════════════════════════════

  private _connectMeterToTap(): void {
    const tap = this._meterPostFader ? this._gain : this._trim;
    this._busMeter.connectToTap(tap);
  }

  public getMeterNode(): AudioWorkletNode | null {
    return this._busMeter.node;
  }

  public setMeterPostFader(postFader: boolean): void {
    if (this._isDisposed) return;
    if (this._meterPostFader === postFader) return;

    this._meterPostFader = postFader;
    this._connectMeterToTap();
    this._emit({ type: 'meterModeChanged', postFader });
  }

  public isMeterPostFader(): boolean {
    return this._meterPostFader;
  }

  // ═══════════════════════════════════════════
  // Effect chain
  // ═══════════════════════════════════════════

  public setEffectChain(chain: IEffectChain | null): void {
    if (this._isDisposed) return;
    if (this._effectChain === chain) return;

    if (this._effectChain) {
      try { this._effectChain.outputNode.disconnect(this._panner); } catch { /* ignore */ }
    }

    this._effectChain = chain;
    this._connectAfterTrim();

    if (chain) {
      this._emit({ type: 'effectChainAttached' });
      this._log('EffectChain conectada');
    } else {
      this._emit({ type: 'effectChainDetached' });
      this._log('EffectChain desconectada');
    }
  }

  public getEffectChain(): IEffectChain | null {
    return this._effectChain;
  }

  public hasEffectChain(): boolean {
    return this._effectChain !== null;
  }

  // ═══════════════════════════════════════════
  // Send taps (REAPER-style)
  // ═══════════════════════════════════════════

  /**
   * pre-fader  = trim (después de FX, antes del panner+fader)
   * post-fader = gain (después del fader, antes del mute)
   * Ambos taps NO pasan por muteGate → sends activos aunque bus muted.
   */
  public getSendSource(preFader: boolean): AudioNode {
    this._assertNotDisposed();
    return preFader ? this._trim : this._gain;
  }

  // ═══════════════════════════════════════════
  // Conexión / desconexión
  // ═══════════════════════════════════════════

  public connect(destination: AudioNode): void {
    this._assertNotDisposed();
    if (this._connections.has(destination)) return;

    this._output.connect(destination);
    this._connections.add(destination);
    this._emit({ type: 'connected', destination });
  }

  public disconnect(destination?: AudioNode): void {
    if (this._isDisposed) return;

    try {
      if (destination) {
        this._output.disconnect(destination);
        this._connections.delete(destination);
        this._emit({ type: 'disconnected', destination });
      } else {
        this._output.disconnect();
        this._connections.clear();
        this._emit({ type: 'disconnected' });
      }
    } catch (err) {
      this._log(`Error al desconectar: ${getBusErrorMessage(err)}`, 'warn');
    }
  }

  public get input(): GainNode {
    this._assertNotDisposed();
    return this._input;
  }

  public get output(): GainNode {
    this._assertNotDisposed();
    return this._output;
  }

  // ═══════════════════════════════════════════
  // Volumen
  // ═══════════════════════════════════════════

  public setVolume(value: number): void {
    if (this._isDisposed) return;
    const clamped = clampBusValue(value, BUS_VOLUME_MIN, BUS_VOLUME_MAX);
    if (this._volume === clamped) return;

    this._volume = clamped;
    this._gain.gain.setTargetAtTime(clamped, this._ctx.currentTime, this._config.fadeTime);
    this._emit({ type: 'volumeChanged', volume: clamped });
  }

  public getVolume(): number {
    return this._volume;
  }

  // ═══════════════════════════════════════════
  // Trim
  // ═══════════════════════════════════════════

  public setTrim(value: number): void {
    if (this._isDisposed) return;
    const clamped = clampBusValue(value, BUS_TRIM_MIN, BUS_TRIM_MAX);
    if (this._trimValue === clamped) return;

    this._trimValue = clamped;
    this._trim.gain.setTargetAtTime(clamped, this._ctx.currentTime, this._config.fadeTime);
    this._emit({ type: 'trimChanged', trim: clamped });
  }

  public getTrim(): number {
    return this._trimValue;
  }

  // ═══════════════════════════════════════════
  // Pan
  // ═══════════════════════════════════════════

  public setPan(value: number): void {
    if (this._isDisposed) return;
    const clamped = clampBusValue(value, BUS_PAN_MIN, BUS_PAN_MAX);
    if (this._pan === clamped) return;

    this._pan = clamped;
    this._panner.pan.setTargetAtTime(clamped, this._ctx.currentTime, this._config.fadeTime);
    this._emit({ type: 'panChanged', pan: clamped });
  }

  public getPan(): number {
    return this._pan;
  }

  // ═══════════════════════════════════════════
  // Pan Law
  // ═══════════════════════════════════════════

  public setPanLaw(law: PanLaw): void {
    if (this._isDisposed) return;
    if (this._panLaw === law) return;

    this._panLaw = law;
    this._panLawGain.gain.setTargetAtTime(
      panLawCenterGain(law),
      this._ctx.currentTime,
      this._config.fadeTime
    );
    this._emit({ type: 'panLawChanged', panLaw: law });
  }

  public getPanLaw(): PanLaw {
    return this._panLaw;
  }

  // ═══════════════════════════════════════════
  // Mute
  // ═══════════════════════════════════════════

  public setMuted(muted: boolean): void {
    if (this._isDisposed) return;
    if (this._muted === muted) return;

    this._muted = muted;
    this._muteGate.gain.setTargetAtTime(
      muted ? 0 : 1,
      this._ctx.currentTime,
      BUS_MUTE_FADE_TIME
    );
    this._emit({ type: 'muteChanged', muted });
  }

  public isMuted(): boolean {
    return this._muted;
  }

  public panic(): void {
    if (this._isDisposed) return;
    this._muteGate.gain.setValueAtTime(0, this._ctx.currentTime);
    this._muted = true;
    this._emit({ type: 'muteChanged', muted: true });
    this._log('PANIC — señal cortada', 'warn');
  }

  // ═══════════════════════════════════════════
  // Eventos
  // ═══════════════════════════════════════════

  public on(listener: BusNodeListener): () => void {
    this._listeners.add(listener);
    return () => { this._listeners.delete(listener); };
  }

  private _emit(event: BusNodeEvent): void {
    const snapshot = Array.from(this._listeners);
    for (const listener of snapshot) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[BusNode:${this.id}] Error en listener:`, err);
      }
    }
  }

  // ═══════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════

  public getStats(): BusNodeStats {
    return {
      id: this.id,
      kind: this.kind,
      volume: this._volume,
      pan: this._pan,
      trim: this._trimValue,
      muted: this._muted,
      panLaw: this._panLaw,
      meterPostFader: this._meterPostFader,
      hasMeter: this._busMeter.node !== null,
      hasEffectChain: this._effectChain !== null,
      isDisposed: this._isDisposed,
      connectionCount: this._connections.size,
    };
  }

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  public get context(): AudioContext {
    return this._ctx;
  }

  // ═══════════════════════════════════════════
  // Dispose
  // ═══════════════════════════════════════════

  public dispose(): void {
    if (this._isDisposed) return;

    try {
      try { this._muteGate.gain.setValueAtTime(0, this._ctx.currentTime); } catch { /* ignore */ }

      const nodes: AudioNode[] = [
        this._output,
        this._muteGate,
        this._gain,
        this._panLawGain,
        this._panner,
        this._trim,
        this._input,
      ];
      for (const node of nodes) {
        try { node.disconnect(); } catch { /* ignore */ }
      }

      this._busMeter.dispose();

      if (this._effectChain) {
        try { this._effectChain.outputNode.disconnect(this._panner); } catch { /* ignore */ }
        this._effectChain = null;
      }

      this._connections.clear();
      this._isDisposed = true;
      this._emit({ type: 'disposed' });
      this._listeners.clear();

      this._log('Disposed');
    } catch (err) {
      this._log(`Error en dispose: ${getBusErrorMessage(err)}`, 'error');
    }
  }

  // ═══════════════════════════════════════════
  // Internos
  // ═══════════════════════════════════════════

  private _assertNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error(`[BusNode:${this.id}] Ya fue disposed`);
    }
  }

  private _log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this._config.verbose && level === 'info') return;

    const prefix = `[BusNode:${this.id}]`;
    switch (level) {
      case 'error': console.error(prefix, msg); break;
      case 'warn':  console.warn(prefix, msg);  break;
      default:      console.info(prefix, msg);
    }
  }
}