// src/audio/engine/AudioEngine.ts

import { AudioContextManager, audioContextManager } from './AudioContextManager';
import { RoutingGraph } from '@audio/graph/RoutingGraph';
import { MasterBus } from '@audio/graph/MasterBus';
import { MeterManager } from '@audio/metering/MeterManager';
import { MicRecorder } from '@audio/recording/MicRecorder';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export type AudioEngineState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'suspended'
  | 'error'
  | 'disposed';

export interface AudioEngineConfig {
  sampleRate?: number;
  latencyHint?: AudioContextLatencyCategory | number;
  fadeTime?: number;
  initialVolume?: number;
  initialMuted?: boolean;
  verbose?: boolean;
  contextManager?: AudioContextManager;
  masterLimiterEnabled?: boolean;
  masterHeadroomDb?: number;
}

export interface AudioEngineStats {
  state: AudioEngineState;
  sampleRate: number;
  currentTime: number;
  audioOutputTime: number;
  baseLatency: number;
  outputLatency: number;
  isMuted: boolean;
  masterVolume: number;
  contextState: AudioContextState | 'uninitialized';
  lastError: string | null;
  masterGainReductionDb: number;
}

export type AudioEngineEvent =
  | { type: 'stateChanged'; state: AudioEngineState; previous: AudioEngineState }
  | { type: 'initialized'; sampleRate: number }
  | { type: 'volumeChanged'; volume: number }
  | { type: 'muteChanged'; muted: boolean }
  | { type: 'error'; error: Error; phase: 'init' | 'dispose' | 'runtime' }
  | { type: 'disposed' };

export type AudioEngineListener = (event: AudioEngineEvent) => void;

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: Required<Omit<AudioEngineConfig, 'contextManager'>> = {
  sampleRate: 48000,
  latencyHint: 'interactive',
  fadeTime: 0.01,
  initialVolume: 1,
  initialMuted: false,
  verbose: import.meta.env?.DEV ?? false,
  masterLimiterEnabled: false,
  masterHeadroomDb: 0,
};

const MASTER_BUS_ID = 'master' as const;

// ═══════════════════════════════════════════════════════════════
// 🎯 CLASE
// ═══════════════════════════════════════════════════════════════

export class AudioEngine {
  private readonly _ctxManager: AudioContextManager;
  private _masterBus: MasterBus | null = null;
  private _routingGraph: RoutingGraph | null = null;
  private _micRecorder: MicRecorder | null = null;

  private _state: AudioEngineState = 'uninitialized';
  private _config: Required<Omit<AudioEngineConfig, 'contextManager'>>;

  private _lastVolume: number;
  private _isMuted: boolean;

  private readonly _listeners = new Set<AudioEngineListener>();

  private _initPromise: Promise<void> | null = null;
  private _lastInitError: Error | null = null;

  private _contextStateUnsub: (() => void) | null = null;

  private readonly _instanceId: string;

  constructor(config: AudioEngineConfig = {}) {
    const { contextManager, ...rest } = config;
    this._ctxManager = contextManager ?? audioContextManager;
    this._config = { ...DEFAULT_CONFIG, ...rest };
    this._lastVolume = this._config.initialVolume;
    this._isMuted = this._config.initialMuted;
    this._instanceId = `engine-${Math.random().toString(36).slice(2, 9)}`;
  }

  // ═══════════════════════════════════════════
  // Inicialización
  // ═══════════════════════════════════════════

  public async init(sampleRateOverride?: number): Promise<void> {
    if (this._state === 'ready') return;
    if (this._state === 'disposed') {
      throw new Error('[AudioEngine] Engine disposed. Crea una nueva instancia.');
    }
    if (this._state === 'error' && this._lastInitError) {
      throw new Error(
        `[AudioEngine] Init previo falló: ${this._lastInitError.message}. ` +
        `Usa restart() para reintentar.`
      );
    }
    if (this._initPromise) return this._initPromise;

    this._initPromise = this._doInit(sampleRateOverride).finally(() => {
      this._initPromise = null;
    });

    return this._initPromise;
  }

  private async _doInit(sampleRateOverride?: number): Promise<void> {
    this._setState('initializing');
    this._lastInitError = null;

    try {
      const sampleRate = sampleRateOverride ?? this._config.sampleRate;

      this._ctxManager.init({
        sampleRate,
        latencyHint: this._config.latencyHint,
        verbose: this._config.verbose,
      });
      await this._ctxManager.resume();

      const ctx = this._ctxManager.context;
      if (!ctx.audioWorklet) {
        throw new Error(
          'AudioWorklet no soportado. Requiere Chrome 66+, Firefox 76+, Safari 14.1+.'
        );
      }

      await MeterManager.loadWorklet(ctx);

      this._masterBus = new MasterBus(MASTER_BUS_ID, ctx, {
        verbose: this._config.verbose,
        volume: this._lastVolume,
        muted: this._isMuted,
        fadeTime: this._config.fadeTime,
        limiterEnabled: this._config.masterLimiterEnabled,
        headroomDb: this._config.masterHeadroomDb,
      });

      this._masterBus.connectToDestination(ctx.destination);

      this._routingGraph = new RoutingGraph(ctx, this._masterBus, {
        verbose: this._config.verbose,
      });

      this._attachContextListeners();

      this._setState('ready');
      this._emit({ type: 'initialized', sampleRate: this._ctxManager.sampleRate });

      this._log(
        `Inicializado @ ${this._ctxManager.sampleRate}Hz | ` +
        `base=${(ctx.baseLatency * 1000).toFixed(1)}ms | ` +
        `output=${((ctx.outputLatency ?? 0) * 1000).toFixed(1)}ms | ` +
        `limiter=${this._config.masterLimiterEnabled ? 'ON' : 'OFF'} | ` +
        `headroom=${this._config.masterHeadroomDb}dB`
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._lastInitError = error;
      await this._rollbackInit();
      this._setState('error');
      this._emit({ type: 'error', error, phase: 'init' });
      this._log(`Error en init: ${error.message}`, 'error');
      throw error;
    }
  }

  public async restart(config?: AudioEngineConfig): Promise<void> {
    await this.dispose();
    if (config) {
      const { contextManager: _ctxManager, ...rest } = config;
      this._config = { ...DEFAULT_CONFIG, ...rest };
      this._lastVolume = this._config.initialVolume;
      this._isMuted = this._config.initialMuted;
    }
    this._state = 'uninitialized';
    this._lastInitError = null;
    await this.init();
  }

  private async _rollbackInit(): Promise<void> {
    try {
      this._detachContextListeners();

      if (this._routingGraph) {
        this._routingGraph.dispose();
        this._routingGraph = null;
      }
      if (this._masterBus) {
        this._masterBus.dispose();
        this._masterBus = null;
      }
    } catch (err) {
      this._log(`Error en rollback: ${errMsg(err)}`, 'warn');
    }
  }

  // ═══════════════════════════════════════════
  // Control del contexto
  // ═══════════════════════════════════════════

  public async suspend(): Promise<void> {
    if (this._state !== 'ready') return;
    try {
      await this._ctxManager.suspend();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._emit({ type: 'error', error, phase: 'runtime' });
      throw error;
    }
  }

  public async resume(): Promise<void> {
    if (this._state === 'ready') return;
    if (this._state !== 'suspended') {
      this._log(`resume() en estado inválido: ${this._state}`, 'warn');
      return;
    }
    try {
      await this._ctxManager.resume();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._emit({ type: 'error', error, phase: 'runtime' });
      throw error;
    }
  }

  // ═══════════════════════════════════════════
  // Volumen master
  // ═══════════════════════════════════════════

  public setMasterVolume(value: number): void {
    const clamped = this._clampVolume(value);
    if (clamped === this._lastVolume) return;

    this._lastVolume = clamped;
    if (this._masterBus) {
      this._masterBus.setVolume(clamped);
    }
    this._emit({ type: 'volumeChanged', volume: clamped });
  }

  public getMasterVolume(): number {
    return this._lastVolume;
  }

  public setMuted(muted: boolean): void {
    if (this._isMuted === muted) return;
    this._isMuted = muted;
    if (this._masterBus) {
      this._masterBus.setMuted(muted);
    }
    this._emit({ type: 'muteChanged', muted });
  }

  public isMuted(): boolean {
    return this._isMuted;
  }

  public panic(): void {
    if (!this._isReady() || !this._masterBus) return;
    this._masterBus.panic();
    this._isMuted = true;
    this._emit({ type: 'muteChanged', muted: true });
    this._log('PANIC — todo silenciado', 'warn');
  }

  private _clampVolume(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(1, value));
  }

  // ═══════════════════════════════════════════
  // Master limiter / headroom
  // ═══════════════════════════════════════════

  public setMasterLimiterEnabled(enabled: boolean): void {
    this._masterBus?.setLimiterEnabled(enabled);
  }

  public isMasterLimiterEnabled(): boolean {
    return this._masterBus?.isLimiterEnabled() ?? false;
  }

  public setMasterHeadroom(db: number): void {
    this._masterBus?.setHeadroom(db);
  }

  public getMasterHeadroom(): number {
    return this._masterBus?.getHeadroom() ?? 0;
  }

  // ═══════════════════════════════════════════
  // MicRecorder — lazy init
  // ═══════════════════════════════════════════

  /**
   * Devuelve el MicRecorder, inicializándolo si aún no existe.
   * Requiere que el engine esté en estado 'ready'.
   */
  public async getMicRecorder(): Promise<MicRecorder> {
    if (this._state !== 'ready') {
      throw new Error(
        '[AudioEngine] getMicRecorder() requiere estado ready. Llama a init() primero.'
      );
    }

    if (!this._micRecorder) {
      const micRecorder = new MicRecorder(
        'mic-recorder-main',
        this._ctxManager.context,
        { verbose: this._config.verbose }
      );

      await micRecorder.init();
      micRecorder.monitorOutput.connect(this.masterBus.input);
      this._micRecorder = micRecorder;
      this._log('MicRecorder inicializado (lazy)');
    }

    const micRecorder = this._micRecorder;
    if (!micRecorder) {
      throw new Error('[AudioEngine] MicRecorder no disponible tras la inicialización.');
    }

    return micRecorder;
  }

  /**
   * Devuelve el MicRecorder si ya existe, sin inicializar.
   * Útil para el path de detener grabación (sync, sin await).
   */
  public getMicRecorderSync(): MicRecorder | null {
    return this._micRecorder;
  }

  // ═══════════════════════════════════════════
  // Sistema de eventos
  // ═══════════════════════════════════════════

  public on(listener: AudioEngineListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _emit(event: AudioEngineEvent): void {
    const snapshot = Array.from(this._listeners);
    for (const listener of snapshot) {
      try {
        listener(event);
      } catch (err) {
        console.error('[AudioEngine] Error en listener:', err);
      }
    }
  }

  // ═══════════════════════════════════════════
  // Estado y métricas
  // ═══════════════════════════════════════════

  public get state(): AudioEngineState {
    return this._state;
  }

  public get isInitialized(): boolean {
    return this._state === 'ready' || this._state === 'suspended';
  }

  public getStats(): AudioEngineStats {
    if (!this._ctxManager.isInitialized) {
      return {
        state: this._state,
        sampleRate: 0,
        currentTime: 0,
        audioOutputTime: 0,
        baseLatency: 0,
        outputLatency: 0,
        isMuted: this._isMuted,
        masterVolume: this._lastVolume,
        contextState: 'uninitialized',
        lastError: this._lastInitError?.message ?? null,
        masterGainReductionDb: 0,
      };
    }

    const ctx = this._ctxManager.context;
    const outputLatency = ctx.outputLatency ?? 0;

    return {
      state: this._state,
      sampleRate: ctx.sampleRate,
      currentTime: ctx.currentTime,
      audioOutputTime: ctx.currentTime + outputLatency,
      baseLatency: ctx.baseLatency,
      outputLatency,
      isMuted: this._isMuted,
      masterVolume: this._lastVolume,
      contextState: ctx.state,
      lastError: this._lastInitError?.message ?? null,
      masterGainReductionDb: this._masterBus?.getGainReductionDb() ?? 0,
    };
  }

  // ═══════════════════════════════════════════
  // Getters
  // ═══════════════════════════════════════════

  public get context(): AudioContext {
    return this._ctxManager.context;
  }

  /** @deprecated Usa `masterBus.input` directamente. */
  public get master(): AudioNode {
    if (!this._masterBus) {
      throw new Error('[AudioEngine] MasterBus no inicializado. Llama a init() primero.');
    }
    return this._masterBus.input;
  }

  public get masterBus(): MasterBus {
    if (!this._masterBus) {
      throw new Error('[AudioEngine] MasterBus no inicializado. Llama a init() primero.');
    }
    return this._masterBus;
  }

  public get sampleRate(): number {
    return this._ctxManager.sampleRate;
  }

  public get currentTime(): number {
    return this._ctxManager.currentTime;
  }

  public get audioOutputTime(): number {
    const ctx = this._ctxManager.context;
    return ctx.currentTime + (ctx.outputLatency ?? 0);
  }

  public get routingGraph(): RoutingGraph {
    if (!this._routingGraph) {
      throw new Error('[AudioEngine] RoutingGraph no inicializado. Llama a init() primero.');
    }
    return this._routingGraph;
  }

  /** @deprecated Usa `masterBus.getMeterNode()`. */
  public get masterMeter(): AudioWorkletNode | null {
    return this._masterBus?.getMeterNode() ?? null;
  }

  // ═══════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════

  public async dispose(): Promise<void> {
    if (this._state === 'disposed' || this._state === 'uninitialized') {
      this._listeners.clear();
      return;
    }

    try {
      if (this._isReady() && this._masterBus) {
        try { this._masterBus.panic(); } catch { /* ignore */ }
      }

      this._detachContextListeners();

      // MicRecorder primero (no tiene dependencias del graph)
      if (this._micRecorder) {
        this._micRecorder.dispose();
        this._micRecorder = null;
      }

      // RoutingGraph (tiene referencias al MasterBus)
      if (this._routingGraph) {
        this._routingGraph.dispose();
        this._routingGraph = null;
      }

      // MasterBus al final
      if (this._masterBus) {
        this._masterBus.dispose();
        this._masterBus = null;
      }

      await this._ctxManager.suspend();

      this._setState('disposed');
      this._emit({ type: 'disposed' });
      this._listeners.clear();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._emit({ type: 'error', error, phase: 'dispose' });
      this._log(`Error en dispose: ${error.message}`, 'error');
      throw error;
    }
  }

  // ═══════════════════════════════════════════
  // Internos
  // ═══════════════════════════════════════════

  private _isReady(): boolean {
    return this._state === 'ready';
  }

  private _setState(state: AudioEngineState): void {
    if (this._state === state) return;
    const previous = this._state;
    this._state = state;
    this._emit({ type: 'stateChanged', state, previous });
  }

  private _attachContextListeners(): void {
    if (this._contextStateUnsub) return;

    this._contextStateUnsub = this._ctxManager.on((event) => {
      if (event.type !== 'stateChanged') return;

      const ctxState = event.state;

      if (ctxState === 'suspended' && this._state === 'ready') {
        this._setState('suspended');
      } else if (ctxState === 'running' && this._state === 'suspended') {
        this._setState('ready');
      } else if (ctxState === 'closed' && this._state !== 'disposed') {
        const error = new Error('AudioContext cerrado inesperadamente');
        this._emit({ type: 'error', error, phase: 'runtime' });
      }
    });
  }

  private _detachContextListeners(): void {
    this._contextStateUnsub?.();
    this._contextStateUnsub = null;
  }

  private _log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this._config.verbose && level === 'info') return;

    const prefix = `[AudioEngine:${this._instanceId}]`;
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

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ═══════════════════════════════════════════════════════════════
// 🎯 SINGLETON
// ═══════════════════════════════════════════════════════════════

export const audioEngine = new AudioEngine();