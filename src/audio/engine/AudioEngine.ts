// src/audio/engine/AudioEngine.ts

import {
  AudioContextManager,
  audioContextManager,
} from './AudioContextManager';
import { RoutingGraph } from '@audio/graph/RoutingGraph';
import type { MasterBus } from '@audio/graph/MasterBus';
import type { MicRecorder } from '@audio/recording/MicRecorder';

import type {
  AudioEngineConfig,
  AudioEngineListener,
  AudioEngineState,
  AudioEngineStats,
  ResolvedAudioEngineConfig,
} from './types';
import { DEFAULT_ENGINE_CONFIG } from './constants';
import { AudioEngineEmitter } from './AudioEngineEmitter';
import { MasterControls } from './master/MasterControls';
import { MicRecorderAccess } from './recording/MicRecorderAccess';
import { EngineLifecycle } from './lifecycle/EngineLifecycle';

export type {
  AudioEngineState,
  AudioEngineConfig,
  AudioEngineStats,
  AudioEngineEvent,
  AudioEngineListener,
} from './types';

export class AudioEngine {
  private readonly _ctxManager: AudioContextManager;
  private readonly _emitter = new AudioEngineEmitter();
  private readonly _instanceId: string;

  private _config: ResolvedAudioEngineConfig;
  private _state: AudioEngineState = 'uninitialized';
  private _lastInitError: Error | null = null;
  private _contextStateUnsub: (() => void) | null = null;

  private _masterBus: MasterBus | null = null;
  private _routingGraph: RoutingGraph | null = null;

  private readonly _master: MasterControls;
  private readonly _mic: MicRecorderAccess;
  private readonly _lifecycle: EngineLifecycle;

  constructor(config: AudioEngineConfig = {}) {
    const { contextManager, ...rest } = config;
    this._ctxManager = contextManager ?? audioContextManager;
    this._config = { ...DEFAULT_ENGINE_CONFIG, ...rest };
    this._instanceId = `engine-${Math.random().toString(36).slice(2, 9)}`;

    this._master = new MasterControls(
      this._config.initialVolume,
      this._config.initialMuted,
      this._emitter
    );

    this._mic = new MicRecorderAccess({
      getState: () => this._state,
      getContext: () => this._ctxManager.context,
      getMasterBus: () => this.masterBus,
      verbose: this._config.verbose,
      log: (msg) => this._log(msg),
    });

    const self = this;
    this._lifecycle = new EngineLifecycle({
      getState: () => self._state,
      setState: (s) => self._setState(s),
      getConfig: () => self._config,
      setConfig: (c) => {
        self._config = c;
      },
      ctxManager: self._ctxManager,
      emitter: self._emitter,
      master: self._master,
      mic: self._mic,
      log: (msg, level) => self._log(msg, level),
      graph: {
        get masterBus() {
          return self._masterBus;
        },
        set masterBus(v) {
          self._masterBus = v;
        },
        get routingGraph() {
          return self._routingGraph;
        },
        set routingGraph(v) {
          self._routingGraph = v;
        },
      },
      lastInitError: {
        get current() {
          return self._lastInitError;
        },
        set current(v) {
          self._lastInitError = v;
        },
      },
      attachContextListeners: () => self._attachContextListeners(),
      detachContextListeners: () => self._detachContextListeners(),
    });
  }

  public init(sampleRateOverride?: number): Promise<void> {
    return this._lifecycle.init(sampleRateOverride);
  }

  public restart(config?: AudioEngineConfig): Promise<void> {
    if (!config) return this._lifecycle.restart();
    const { contextManager: _cm, ...rest } = config;
    return this._lifecycle.restart(rest);
  }

  public dispose(): Promise<void> {
    return this._lifecycle.dispose();
  }

  public async suspend(): Promise<void> {
    if (this._state !== 'ready') return;
    try {
      await this._ctxManager.suspend();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._emitter.emit({ type: 'error', error, phase: 'runtime' });
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
      this._emitter.emit({ type: 'error', error, phase: 'runtime' });
      throw error;
    }
  }

  public setMasterVolume(value: number): void {
    this._master.setVolume(value);
  }

  public getMasterVolume(): number {
    return this._master.getVolume();
  }

  public setMuted(muted: boolean): void {
    this._master.setMuted(muted);
  }

  public isMuted(): boolean {
    return this._master.isMuted();
  }

  public panic(): void {
    if (this._state !== 'ready') return;
    this._master.panic();
    this._log('PANIC — todo silenciado', 'warn');
  }

  public setMasterLimiterEnabled(enabled: boolean): void {
    this._master.setLimiterEnabled(enabled);
  }

  public isMasterLimiterEnabled(): boolean {
    return this._master.isLimiterEnabled();
  }

  public setMasterHeadroom(db: number): void {
    this._master.setHeadroom(db);
  }

  public getMasterHeadroom(): number {
    return this._master.getHeadroom();
  }

  public getMicRecorder(): Promise<MicRecorder> {
    return this._mic.get();
  }

  public getMicRecorderSync(): MicRecorder | null {
    return this._mic.getSync();
  }

  public on(listener: AudioEngineListener): () => void {
    return this._emitter.on(listener);
  }

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
        isMuted: this._master.isMuted(),
        masterVolume: this._master.getVolume(),
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
      isMuted: this._master.isMuted(),
      masterVolume: this._master.getVolume(),
      contextState: ctx.state,
      lastError: this._lastInitError?.message ?? null,
      masterGainReductionDb: this._master.getGainReductionDb(),
    };
  }

  public get context(): AudioContext {
    return this._ctxManager.context;
  }

  /** @deprecated Usa `masterBus.input`. */
  public get master(): AudioNode {
    return this.masterBus.input;
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

  private _setState(state: AudioEngineState): void {
    if (this._state === state) return;
    const previous = this._state;
    this._state = state;
    this._emitter.emit({ type: 'stateChanged', state, previous });
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
        this._emitter.emit({
          type: 'error',
          error: new Error('AudioContext cerrado inesperadamente'),
          phase: 'runtime',
        });
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
    if (level === 'error') console.error(prefix, msg);
    else if (level === 'warn') console.warn(prefix, msg);
    else console.info(prefix, msg);
  }
}

export const audioEngine = new AudioEngine();