import { MeterManager } from '@audio/metering/MeterManager';

/**
 * TrackAudioNode
 * --------------
 * Encapsula los AudioNodes de una pista individual.
 *
 * Cadena de señal:
 * ```
 *   input → trim → panner → gain → phaseInvert → output (bus/master)
 *                                        │
 *                                        └──► meter (rama paralela)
 * ```
 *
 * Diseño:
 * - Esta clase NUNCA se guarda en Redux (no es serializable)
 * - Vive solo en el mundo del motor de audio
 * - Cada cambio de parámetro usa `setTargetAtTime` para evitar clicks
 */

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface TrackAudioNodeConfig {
  /** Volumen inicial (0-1, default: 0.8) */
  volume?: number;
  /** Pan inicial (-1 a 1, default: 0) */
  pan?: number;
  /** Tiempo de fade al cambiar parámetros en segundos (default: 0.01) */
  fadeTime?: number;
  /** Habilitar logs (default: true en dev) */
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
  isDisposed: boolean;
}

export type TrackAudioNodeEvent =
  | { type: 'volumeChanged'; volume: number }
  | { type: 'panChanged'; pan: number }
  | { type: 'trimChanged'; trim: number }
  | { type: 'muteChanged'; muted: boolean }
  | { type: 'phaseChanged'; inverted: boolean }
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
  private _input: GainNode;         // Entrada de audio
  private _trim: GainNode;          // Ganancia de entrada (trim)
  private _panner: StereoPannerNode;
  private _gain: GainNode;          // Volumen principal
  private _phaseInvert: GainNode;   // Inversión de fase (-1 o +1)
  private _meter: AudioWorkletNode | null = null;

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

    // Conectar cadena principal
    this._input.connect(this._trim);
    this._trim.connect(this._panner);
    this._panner.connect(this._gain);
    this._gain.connect(this._phaseInvert);

    // Meter en rama paralela
    this._attachMeter();

    this._log(`Creada`);
  }

  // ─────────────────────────────────────────────
  // Meter
  // ─────────────────────────────────────────────

  private _attachMeter(): void {
    try {
      this._meter = MeterManager.createMeter(this.id, this._ctx);
      // El meter va después del gain pero antes de phaseInvert
      this._gain.connect(this._meter);
    } catch (err) {
      this._log(`Meter no disponible: ${err}`, 'warn');
      this._meter = null;
    }
  }

  /** Devuelve el AudioWorkletNode del meter, o null si no está disponible */
  public getMeterNode(): AudioWorkletNode | null {
    return this._meter;
  }

  // ─────────────────────────────────────────────
  // Conexión / desconexión
  // ─────────────────────────────────────────────

  /** Conecta la salida de la pista a otro nodo (bus o master). */
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

  /** Nodo de entrada donde se conectan los clips/instrumentos. */
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
        clamped,
        this._ctx.currentTime,
        this._config.fadeTime
      );
    }

    this._emit({ type: 'volumeChanged', volume: clamped });
  }

  public getVolume(): number {
    return this._volume;
  }

  // ─────────────────────────────────────────────
  // Trim (ganancia de entrada)
  // ─────────────────────────────────────────────

  /**
   * Ajusta el trim/gain de entrada (0-4, permite hasta +12dB).
   * Útil para nivelar diferentes fuentes antes del volumen principal.
   */
  public setTrim(value: number): void {
    if (this._isDisposed) return;

    const clamped = Math.max(0, Math.min(4, value));
    if (this._trimGain === clamped) return;

    this._trimGain = clamped;
    this._trim.gain.setTargetAtTime(
      clamped,
      this._ctx.currentTime,
      this._config.fadeTime
    );

    this._emit({ type: 'trimChanged', trim: clamped });
  }

  public getTrim(): number {
    return this._trimGain;
  }

  // ─────────────────────────────────────────────
  // Pan
  // ─────────────────────────────────────────────

  public setPan(value: number): void {
    if (this._isDisposed) return;

    const clamped = Math.max(-1, Math.min(1, value));
    if (this._pan === clamped) return;

    this._pan = clamped;
    this._panner.pan.setTargetAtTime(
      clamped,
      this._ctx.currentTime,
      this._config.fadeTime
    );

    this._emit({ type: 'panChanged', pan: clamped });
  }

  public getPan(): number {
    return this._pan;
  }

  // ─────────────────────────────────────────────
  // Mute
  // ─────────────────────────────────────────────

  public setMuted(muted: boolean): void {
    if (this._isDisposed) return;
    if (this._muted === muted) return;

    this._muted = muted;
    const target = muted ? 0 : this._volume;

    this._gain.gain.setTargetAtTime(
      target,
      this._ctx.currentTime,
      this._config.fadeTime
    );

    this._emit({ type: 'muteChanged', muted });
  }

  public isMuted(): boolean {
    return this._muted;
  }

  // ─────────────────────────────────────────────
  // Phase invert
  // ─────────────────────────────────────────────

  /**
   * Invierte la fase de la señal (útil para corregir problemas de fase
   * entre micrófonos o pistas duplicadas).
   */
  public setPhaseInvert(inverted: boolean): void {
    if (this._isDisposed) return;
    if (this._phaseInverted === inverted) return;

    this._phaseInverted = inverted;
    // Cambio instantáneo (sin fade) porque es un flip binario
    this._phaseInvert.gain.setValueAtTime(
      inverted ? -1 : 1,
      this._ctx.currentTime
    );

    this._emit({ type: 'phaseChanged', inverted });
  }

  public isPhaseInverted(): boolean {
    return this._phaseInverted;
  }

  // ─────────────────────────────────────────────
  // Send taps (REAPER-style)
  // ─────────────────────────────────────────────

  /**
   * Devuelve el nodo desde el cual un Send debe tomar la señal.
   *
   * REAPER-style tap points:
   * - **pre-fader**: después del trim/panner, ANTES del volumen (gain).
   *   Tap = `_panner`. La señal ya está paneada pero sin fader aplicado.
   * - **post-fader**: después del volumen, ANTES del phaseInvert.
   *   Tap = `_gain`. La señal refleja el volumen final del track
   *   (y el mute, ya que mute se implementa reduciendo `_gain` a 0).
   *
   * Ambos taps están ANTES del phaseInvert, así que los sends
   * NO heredan la inversión de fase del track (comportamiento
   * REAPER estándar: phase invert es solo para el output principal).
   *
   * Consumido típicamente por `RoutingGraph.createSend()` al construir
   * un `SendReturnNode`.
   *
   * @param preFader true  = tap pre-fader (panner)
   *                 false = tap post-fader (gain, respeta mute)
   */
  public getSendSource(preFader: boolean): AudioNode {
    this._assertNotDisposed();
    return preFader ? this._panner : this._gain;
  }

  // ─────────────────────────────────────────────
  // Sistema de eventos
  // ─────────────────────────────────────────────

  public on(listener: TrackAudioNodeListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _emit(event: TrackAudioNodeEvent): void {
    this._listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error(`[TrackAudioNode:${this.id}] Error en listener:`, err);
      }
    });
  }

  // ─────────────────────────────────────────────
  // Estado y métricas
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
      isDisposed: this._isDisposed,
    };
  }

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  public get context(): AudioContext {
    return this._ctx;
  }

  // ─────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────

  public dispose(): void {
    if (this._isDisposed) return;

    try {
      // Desconectar todo en orden inverso
      try { this._phaseInvert.disconnect(); } catch { /* ignore */ }
      try { this._gain.disconnect(); } catch { /* ignore */ }
      try { this._panner.disconnect(); } catch { /* ignore */ }
      try { this._trim.disconnect(); } catch { /* ignore */ }
      try { this._input.disconnect(); } catch { /* ignore */ }

      // Meter
      if (this._meter) {
        try { this._meter.disconnect(); } catch { /* ignore */ }
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