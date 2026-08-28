// src/audio/engine/lifecycle/EngineLifecycle.ts

import { MeterManager } from '@audio/metering/MeterManager';
import { RoutingGraph } from '@audio/graph/RoutingGraph';
import { MasterBus } from '@audio/graph/MasterBus';
import type { AudioContextManager } from '../AudioContextManager';
import type { AudioEngineEmitter } from '../AudioEngineEmitter';
import type { MasterControls } from '../master/MasterControls';
import type { MicRecorderAccess } from '../recording/MicRecorderAccess';
import type {
  AudioEngineState,
  ResolvedAudioEngineConfig,
} from '../types';
import { MASTER_BUS_ID } from '../constants';

export interface EngineLifecycleHost {
  getState: () => AudioEngineState;
  setState: (state: AudioEngineState) => void;
  getConfig: () => ResolvedAudioEngineConfig;
  setConfig: (config: ResolvedAudioEngineConfig) => void;
  ctxManager: AudioContextManager;
  emitter: AudioEngineEmitter;
  master: MasterControls;
  mic: MicRecorderAccess;
  log: (msg: string, level?: 'info' | 'warn' | 'error') => void;
  graph: {
    masterBus: MasterBus | null;
    routingGraph: RoutingGraph | null;
  };
  lastInitError: { current: Error | null };
  attachContextListeners: () => void;
  detachContextListeners: () => void;
}

/**
 * Ciclo de vida del engine: init / dispose / restart / rollback.
 * Mantiene la secuencia crítica en un solo lugar.
 */
export class EngineLifecycle {
  private _initPromise: Promise<void> | null = null;
  private readonly _host: EngineLifecycleHost;

  constructor(host: EngineLifecycleHost) {
    this._host = host;
  }

  public async init(sampleRateOverride?: number): Promise<void> {
    const state = this._host.getState();

    if (state === 'ready') return;
    if (state === 'disposed') {
      throw new Error('[AudioEngine] Engine disposed. Crea una nueva instancia.');
    }
    if (state === 'error' && this._host.lastInitError.current) {
      throw new Error(
        `[AudioEngine] Init previo falló: ${this._host.lastInitError.current.message}. ` +
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
    this._host.setState('initializing');
    this._host.lastInitError.current = null;

    const config = this._host.getConfig();

    try {
      const sampleRate = sampleRateOverride ?? config.sampleRate;

      this._host.ctxManager.init({
        sampleRate,
        latencyHint: config.latencyHint,
        verbose: config.verbose,
      });
      await this._host.ctxManager.resume();

      const ctx = this._host.ctxManager.context;
      if (!ctx.audioWorklet) {
        throw new Error(
          'AudioWorklet no soportado. Requiere Chrome 66+, Firefox 76+, Safari 14.1+.'
        );
      }

      await MeterManager.loadWorklet(ctx);

      const masterBus = new MasterBus(MASTER_BUS_ID, ctx, {
        verbose: config.verbose,
        volume: this._host.master.getVolume(),
        muted: this._host.master.isMuted(),
        fadeTime: config.fadeTime,
        limiterEnabled: config.masterLimiterEnabled,
        headroomDb: config.masterHeadroomDb,
      });

      masterBus.connectToDestination(ctx.destination);
      this._host.graph.masterBus = masterBus;
      this._host.master.attach(masterBus);

      this._host.graph.routingGraph = new RoutingGraph(ctx, masterBus, {
        verbose: config.verbose,
      });

      this._host.attachContextListeners();

      this._host.setState('ready');
      this._host.emitter.emit({
        type: 'initialized',
        sampleRate: this._host.ctxManager.sampleRate,
      });

      this._host.log(
        `Inicializado @ ${this._host.ctxManager.sampleRate}Hz | ` +
          `base=${(ctx.baseLatency * 1000).toFixed(1)}ms | ` +
          `output=${((ctx.outputLatency ?? 0) * 1000).toFixed(1)}ms | ` +
          `limiter=${config.masterLimiterEnabled ? 'ON' : 'OFF'} | ` +
          `headroom=${config.masterHeadroomDb}dB`
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._host.lastInitError.current = error;
      await this.rollback();
      this._host.setState('error');
      this._host.emitter.emit({ type: 'error', error, phase: 'init' });
      this._host.log(`Error en init: ${error.message}`, 'error');
      throw error;
    }
  }

  public async restart(
    config?: Partial<ResolvedAudioEngineConfig>
  ): Promise<void> {
    await this.dispose();
    if (config) {
      const next = { ...this._host.getConfig(), ...config };
      this._host.setConfig(next);
      this._host.master.resetLocal(next.initialVolume, next.initialMuted);
    }
    this._host.setState('uninitialized');
    this._host.lastInitError.current = null;
    await this.init();
  }

  public async rollback(): Promise<void> {
    try {
      this._host.detachContextListeners();
      this._host.master.detach();

      if (this._host.graph.routingGraph) {
        this._host.graph.routingGraph.dispose();
        this._host.graph.routingGraph = null;
      }
      if (this._host.graph.masterBus) {
        this._host.graph.masterBus.dispose();
        this._host.graph.masterBus = null;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this._host.log(`Error en rollback: ${msg}`, 'warn');
    }
  }

  public async dispose(): Promise<void> {
    const state = this._host.getState();
    if (state === 'disposed' || state === 'uninitialized') {
      this._host.emitter.clear();
      return;
    }

    try {
      if (state === 'ready') {
        try {
          this._host.master.panic();
        } catch {
          /* ignore */
        }
      }

      this._host.detachContextListeners();
      this._host.mic.dispose();
      this._host.master.detach();

      if (this._host.graph.routingGraph) {
        this._host.graph.routingGraph.dispose();
        this._host.graph.routingGraph = null;
      }

      if (this._host.graph.masterBus) {
        this._host.graph.masterBus.dispose();
        this._host.graph.masterBus = null;
      }

      await this._host.ctxManager.suspend();

      this._host.setState('disposed');
      this._host.emitter.emit({ type: 'disposed' });
      this._host.emitter.clear();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._host.emitter.emit({ type: 'error', error, phase: 'dispose' });
      this._host.log(`Error en dispose: ${error.message}`, 'error');
      throw error;
    }
  }
}