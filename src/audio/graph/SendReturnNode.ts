// src/audio/graph/SendReturnNode.ts

import {
  PanLaw,
  panLawCenterGain,
  DEFAULT_PAN_LAW,
} from '@domain/enums/PanLaw';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface SendReturnNodeConfig {
  /**
   * Nivel de envío inicial 0..1 (default: 0).
   * REAPER-style: los sends arrancan en silencio y el usuario los
   * abre. Evita loops accidentales al conectar.
   */
  amount?: number;

  /** Pan inicial -1..+1 (default: 0) */
  pan?: number;

  /** Mute inicial (default: false) */
  muted?: boolean;

  /**
   * true = pre-fader, false = post-fader.
   * ⚠️ INFORMATIVO. El comportamiento pre/post depende del
   * `sourceNode` con el que se construye el send (viene del
   * `getSendSource(preFader)` del bus/track de origen).
   * Este flag solo se usa para `getStats()` y para que el
   * RoutingGraph sepa reconectar si el usuario cambia el modo.
   */
  preFader?: boolean;

  /**
   * Aplica pan al send. Si false → passthrough (más eficiente).
   * Si true, se crea un StereoPannerNode aunque `pan === 0`.
   * (default: true)
   */
  enablePan?: boolean;

  /**
   * Ley de pan a aplicar (default: -3dB REAPER-style).
   * Se aplica como ganancia de compensación al centro.
   */
  panLaw?: PanLaw;

  /** Tiempo de fade para cambios continuos (default: 0.01s) */
  fadeTime?: number;

  /** Habilitar logs (default: true en dev, false en prod) */
  verbose?: boolean;
}

export interface SendReturnNodeStats {
  id: string;
  amount: number;
  pan: number;
  muted: boolean;
  preFader: boolean;
  hasPanner: boolean;
  panLaw: PanLaw;
  isDisposed: boolean;
  isConnected: boolean;
}

export type SendReturnNodeEvent =
  | { type: 'amountChanged'; amount: number }
  | { type: 'panChanged'; pan: number }
  | { type: 'panLawChanged'; panLaw: PanLaw }
  | { type: 'muteChanged'; muted: boolean }
  | { type: 'preFaderChanged'; preFader: boolean }
  | { type: 'sourceReconnected'; source: AudioNode }
  | { type: 'destinationReconnected'; destination: AudioNode }
  | { type: 'disposed' };

export type SendReturnNodeListener = (event: SendReturnNodeEvent) => void;

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: Required<SendReturnNodeConfig> = {
  amount: 0,
  pan: 0,
  muted: false,
  preFader: true,
  enablePan: true,
  panLaw: DEFAULT_PAN_LAW,
  fadeTime: 0.01,
  verbose: import.meta.env?.DEV ?? false,
};

const AMOUNT_MIN = 0;
const AMOUNT_MAX = 1;
const PAN_MIN = -1;
const PAN_MAX = 1;
const MUTE_FADE_TIME = 0.005;

// ═══════════════════════════════════════════════════════════════
// 🎯 CLASE
// ═══════════════════════════════════════════════════════════════

/**
 * SendReturnNode
 * --------------
 * Envío REAPER-style desde un source (track/bus) hacia un destino
 * (típicamente el input de un FX bus / aux bus).
 *
 * Signal path:
 *   sourceNode → input → [panner + panLawGain] → amount → muteGate → output → destinationNode
 *
 * Características REAPER-style:
 * - Amount 0..1 (típicamente atenuación, no amplificación)
 * - Pan opcional con pan law aplicada
 * - Pre/post fader → determinado por qué `sourceNode` te dan al construir
 * - Mute NO detiene automations del amount (mute al final del path)
 * - Guard suave contra self-loop (source === destination)
 *
 * ⚠️ Este nodo NO es dueño de source ni destination.
 *    - No los desconecta al hacer dispose()
 *    - No los dispone
 *    - Solo desconecta sus PROPIAS conexiones a ellos
 *
 * NO se guarda en Redux (no serializable). Vive solo en el motor.
 */
export class SendReturnNode {
  public readonly id: string;

  private readonly _ctx: AudioContext;
  private readonly _config: Required<SendReturnNodeConfig>;

  // ── Nodos de la cadena ─────────────────────────────────────
  private readonly _input: GainNode;
  private readonly _panner: StereoPannerNode | null;
  private readonly _panLawGain: GainNode | null;
  private readonly _amount: GainNode;
  private readonly _muteGate: GainNode;
  private readonly _output: GainNode;

  // ── Estado ──────────────────────────────────────────────────
  private _amountValue: number;
  private _pan: number;
  private _muted: boolean;
  private _preFader: boolean;
  private _panLaw: PanLaw;
  private _isDisposed = false;

  // ── Conexiones externas ─────────────────────────────────────
  // Guardadas para poder reconectar / desconectar limpiamente
  private _sourceNode: AudioNode | null = null;
  private _destinationNode: AudioNode | null = null;

  // ── Eventos ─────────────────────────────────────────────────
  private readonly _listeners = new Set<SendReturnNodeListener>();

  /**
   * @param id            ID del send (típicamente `Send.id` del modelo Redux)
   * @param ctx           AudioContext compartido
   * @param sourceNode    Tap del source (viene de `bus.getSendSource(preFader)`)
   * @param destinationNode Input del destino (típicamente `destBus.input`)
   * @param config        Config opcional
   */
  constructor(
    id: string,
    ctx: AudioContext,
    sourceNode: AudioNode,
    destinationNode: AudioNode,
    config: SendReturnNodeConfig = {}
  ) {
    if (!id || typeof id !== 'string') {
      throw new Error('[SendReturnNode] id inválido');
    }

    // Guard contra self-loop trivial (source === destination).
    // NO detecta loops indirectos (bus A → bus B → bus A) — eso
    // requiere análisis de grafo global en RoutingGraph.
    if (sourceNode === destinationNode) {
      throw new Error(
        `[SendReturnNode:${id}] source === destination (self-loop detectado)`
      );
    }

    this.id = id;
    this._ctx = ctx;
    this._config = { ...DEFAULT_CONFIG, ...config };

    this._amountValue = clamp(this._config.amount, AMOUNT_MIN, AMOUNT_MAX);
    this._pan = clamp(this._config.pan, PAN_MIN, PAN_MAX);
    this._muted = this._config.muted;
    this._preFader = this._config.preFader;
    this._panLaw = this._config.panLaw;

    // ── Crear nodos ────────────────────────────────────────
    this._input = ctx.createGain();
    this._input.gain.value = 1;

    if (this._config.enablePan) {
      this._panner = ctx.createStereoPanner();
      this._panner.pan.value = this._pan;

      this._panLawGain = ctx.createGain();
      this._panLawGain.gain.value = panLawCenterGain(this._panLaw);
    } else {
      this._panner = null;
      this._panLawGain = null;
    }

    this._amount = ctx.createGain();
    this._amount.gain.value = this._amountValue;

    this._muteGate = ctx.createGain();
    this._muteGate.gain.value = this._muted ? 0 : 1;

    this._output = ctx.createGain();
    this._output.gain.value = 1;

    // ── Conectar cadena interna ────────────────────────────
    this._connectInternalChain();

    // ── Conectar source y destination externos ─────────────
    this._connectSource(sourceNode);
    this._connectDestination(destinationNode);

    this._log(
      `Creado: amount=${this._amountValue.toFixed(2)} pan=${this._pan.toFixed(2)} ` +
      `${this._preFader ? 'pre-fader' : 'post-fader'} ` +
      `${this._config.enablePan ? '(pan on)' : '(pan off)'}`
    );
  }

  // ═══════════════════════════════════════════
  // Conexiones internas
  // ═══════════════════════════════════════════

  /**
   * Conecta input → [panner + panLawGain] → amount → muteGate → output.
   * Idempotente: se puede llamar varias veces (Web Audio no duplica
   * conexiones entre los mismos dos nodos).
   */
  private _connectInternalChain(): void {
    if (this._panner && this._panLawGain) {
      this._input.connect(this._panner);
      this._panner.connect(this._panLawGain);
      this._panLawGain.connect(this._amount);
    } else {
      this._input.connect(this._amount);
    }

    this._amount.connect(this._muteGate);
    this._muteGate.connect(this._output);
  }

  private _connectSource(sourceNode: AudioNode): void {
    // Desconectar el source anterior si había uno (evita fugas)
    if (this._sourceNode && this._sourceNode !== sourceNode) {
      try {
        this._sourceNode.disconnect(this._input);
      } catch { /* ignore */ }
    }

    sourceNode.connect(this._input);
    this._sourceNode = sourceNode;
  }

  private _connectDestination(destinationNode: AudioNode): void {
    // Desconectar el destination anterior si había uno
    if (this._destinationNode && this._destinationNode !== destinationNode) {
      try {
        this._output.disconnect(this._destinationNode);
      } catch { /* ignore */ }
    }

    this._output.connect(destinationNode);
    this._destinationNode = destinationNode;
  }

  // ═══════════════════════════════════════════
  // Reconexión (para cambios de routing en runtime)
  // ═══════════════════════════════════════════

  /**
   * Reconecta el source (típicamente al cambiar pre/post fader).
   * El RoutingGraph llamará esto pidiendo el nuevo tap point al bus.
   */
  public reconnectSource(sourceNode: AudioNode): void {
    this._assertNotDisposed();

    if (this._sourceNode === sourceNode) return;

    if (sourceNode === this._destinationNode) {
      throw new Error(
        `[SendReturnNode:${this.id}] Nuevo source === destination (self-loop)`
      );
    }

    this._connectSource(sourceNode);
    this._emit({ type: 'sourceReconnected', source: sourceNode });
    this._log('Source reconectado');
  }

  /**
   * Reconecta el destination (al cambiar el bus destino).
   */
  public reconnectDestination(destinationNode: AudioNode): void {
    this._assertNotDisposed();

    if (this._destinationNode === destinationNode) return;

    if (destinationNode === this._sourceNode) {
      throw new Error(
        `[SendReturnNode:${this.id}] Nuevo destination === source (self-loop)`
      );
    }

    this._connectDestination(destinationNode);
    this._emit({ type: 'destinationReconnected', destination: destinationNode });
    this._log('Destination reconectado');
  }

  // ═══════════════════════════════════════════
  // Amount (send level)
  // ═══════════════════════════════════════════

  /**
   * Nivel del envío 0..1.
   * REAPER-style: típicamente atenuación. Para amplificar sobre
   * unity, usar el trim del bus destino.
   */
  public setAmount(value: number): void {
    if (this._isDisposed) return;
    const clamped = clamp(value, AMOUNT_MIN, AMOUNT_MAX);
    if (this._amountValue === clamped) return;

    this._amountValue = clamped;
    this._amount.gain.setTargetAtTime(
      clamped,
      this._ctx.currentTime,
      this._config.fadeTime
    );
    this._emit({ type: 'amountChanged', amount: clamped });
  }

  public getAmount(): number {
    return this._amountValue;
  }

  // ═══════════════════════════════════════════
  // Pan
  // ═══════════════════════════════════════════

  /**
   * Cambia el pan del send. Silencioso (no-op) si el send se creó
   * con `enablePan: false`.
   */
  public setPan(value: number): void {
    if (this._isDisposed) return;
    if (!this._panner) {
      this._log('setPan ignorado: enablePan=false', 'warn');
      return;
    }
    const clamped = clamp(value, PAN_MIN, PAN_MAX);
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

  public hasPan(): boolean {
    return this._panner !== null;
  }

  // ═══════════════════════════════════════════
  // Pan Law
  // ═══════════════════════════════════════════

  /**
   * Cambia la ley de pan en runtime.
   * Ver `BusNode.setPanLaw` para justificación del approach
   * (ganancia constante al centro, no interpolación por posición).
   */
  public setPanLaw(law: PanLaw): void {
    if (this._isDisposed) return;
    if (!this._panLawGain) {
      this._log('setPanLaw ignorado: enablePan=false', 'warn');
      return;
    }
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

  /**
   * Mute del send. El corte ocurre al final del path, por lo que
   * las automations del amount siguen procesándose (útil para
   * fades de send en tiempo real controlados desde UI).
   */
  public setMuted(muted: boolean): void {
    if (this._isDisposed) return;
    if (this._muted === muted) return;

    this._muted = muted;
    this._muteGate.gain.setTargetAtTime(
      muted ? 0 : 1,
      this._ctx.currentTime,
      MUTE_FADE_TIME
    );
    this._emit({ type: 'muteChanged', muted });
  }

  public isMuted(): boolean {
    return this._muted;
  }

  // ═══════════════════════════════════════════
  // Pre/Post fader flag (informativo)
  // ═══════════════════════════════════════════

  /**
   * Marca el send como pre o post fader.
   *
   * ⚠️ CAMBIAR ESTE FLAG NO RECONECTA el source automáticamente.
   *    El RoutingGraph debe:
   *      1. Llamar `send.setPreFader(newValue)` para actualizar el flag
   *      2. Llamar `send.reconnectSource(bus.getSendSource(newValue))`
   *         para reconectar al tap correcto del bus.
   *
   *    Se hace así para desacoplar SendReturnNode de la existencia
   *    de un BusNode conocido.
   */
  public setPreFader(preFader: boolean): void {
    if (this._isDisposed) return;
    if (this._preFader === preFader) return;

    this._preFader = preFader;
    this._emit({ type: 'preFaderChanged', preFader });
  }

  public isPreFader(): boolean {
    return this._preFader;
  }

  // ═══════════════════════════════════════════
  // Accesores públicos
  // ═══════════════════════════════════════════

  public get input(): GainNode {
    this._assertNotDisposed();
    return this._input;
  }

  public get output(): GainNode {
    this._assertNotDisposed();
    return this._output;
  }

  public getSourceNode(): AudioNode | null {
    return this._sourceNode;
  }

  public getDestinationNode(): AudioNode | null {
    return this._destinationNode;
  }

  // ═══════════════════════════════════════════
  // Sistema de eventos
  // ═══════════════════════════════════════════

  public on(listener: SendReturnNodeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _emit(event: SendReturnNodeEvent): void {
    // Snapshot para permitir unsub durante el emit
    const snapshot = Array.from(this._listeners);
    for (const listener of snapshot) {
      try {
        listener(event);
      } catch (err) {
        console.error(`[SendReturnNode:${this.id}] Error en listener:`, err);
      }
    }
  }

  // ═══════════════════════════════════════════
  // Estado y métricas
  // ═══════════════════════════════════════════

  public getStats(): SendReturnNodeStats {
    return {
      id: this.id,
      amount: this._amountValue,
      pan: this._pan,
      muted: this._muted,
      preFader: this._preFader,
      hasPanner: this._panner !== null,
      panLaw: this._panLaw,
      isDisposed: this._isDisposed,
      isConnected:
        this._sourceNode !== null && this._destinationNode !== null,
    };
  }

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  public get context(): AudioContext {
    return this._ctx;
  }

  // ═══════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════

  /**
   * Destruye el send y desconecta todos SUS nodos internos.
   *
   * NO desconecta ni dispone `sourceNode` ni `destinationNode`
   * (son propiedad de otros — típicamente BusNodes).
   * Solo removemos NUESTRAS conexiones a ellos.
   */
  public dispose(): void {
    if (this._isDisposed) return;

    try {
      // Cortar audio primero para evitar clicks
      try {
        this._muteGate.gain.setValueAtTime(0, this._ctx.currentTime);
      } catch { /* ignore */ }

      // Desconectar del source externo (source → input)
      if (this._sourceNode) {
        try {
          this._sourceNode.disconnect(this._input);
        } catch { /* ignore */ }
        this._sourceNode = null;
      }

      // Desconectar del destination externo (output → destination)
      if (this._destinationNode) {
        try {
          this._output.disconnect(this._destinationNode);
        } catch { /* ignore */ }
        this._destinationNode = null;
      }

      // Desconectar cadena interna (en orden inverso)
      const nodes: (AudioNode | null)[] = [
        this._output,
        this._muteGate,
        this._amount,
        this._panLawGain,
        this._panner,
        this._input,
      ];
      for (const node of nodes) {
        if (!node) continue;
        try { node.disconnect(); } catch { /* ignore */ }
      }

      this._isDisposed = true;
      this._emit({ type: 'disposed' });
      this._listeners.clear();

      this._log('Disposed');
    } catch (err) {
      this._log(`Error en dispose: ${errMsg(err)}`, 'error');
    }
  }

  // ═══════════════════════════════════════════
  // Internos
  // ═══════════════════════════════════════════

  private _assertNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error(`[SendReturnNode:${this.id}] Ya fue disposed`);
    }
  }

  private _log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this._config.verbose && level === 'info') return;

    const prefix = `[SendReturnNode:${this.id}]`;
    switch (level) {
      case 'error': console.error(prefix, msg); break;
      case 'warn':  console.warn(prefix, msg);  break;
      default:      console.info(prefix, msg);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}