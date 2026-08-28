// src/state/bridges/StoreAudioBridge.ts

import type { Store } from '@reduxjs/toolkit';
import { TransportScheduler } from '@audio/scheduling/TransportScheduler';
import type { RootState } from '@state/store';
import { SchedulerReduxContext } from './SchedulerReduxContext';

import type {
  StoreAudioBridgeConfig,
  StoreAudioBridgeListener,
  StoreAudioBridgeStats,
  TransportSnapshot,
} from './storeAudioBridge/types';
import {
  defaultBridgeVerbose,
  LOG_PREFIX,
  toBridgeError,
} from './storeAudioBridge/constants';
import {
  createEmptyTransportSnapshot,
  takeTransportSnapshot,
} from './storeAudioBridge/transportSnapshot';
import { StoreAudioBridgeEmitter } from './storeAudioBridge/StoreAudioBridgeEmitter';
import { TransportSync } from './storeAudioBridge/TransportSync';
import { InitialStateSync } from './storeAudioBridge/InitialStateSync';

export type {
  StoreAudioBridgeConfig,
  StoreAudioBridgeStats,
  StoreAudioBridgeEvent,
  StoreAudioBridgeListener,
} from './storeAudioBridge/types';

/**
 * StoreAudioBridge
 * ----------------
 * Puente ligero entre Redux y el motor de audio (transport + sync inicial).
 *
 * Delega:
 *  - eventos     → StoreAudioBridgeEmitter
 *  - transport   → TransportSync
 *  - sync inicial→ InitialStateSync
 *  - snapshot    → transportSnapshot helpers
 *
 * NO se ocupa de volumen/pan/mute reactivo (audioSyncMiddleware).
 */
export class StoreAudioBridge {
  private readonly _store: Store<RootState>;
  private readonly _scheduler: TransportScheduler;
  private readonly _verbose: boolean;

  private readonly _emitter: StoreAudioBridgeEmitter;
  private readonly _transportSync: TransportSync;
  private readonly _initialSync: InitialStateSync;

  private _unsubscribe: (() => void) | null = null;
  private _isAttached = false;
  private _pendingSync = false;

  private _prev: TransportSnapshot = createEmptyTransportSnapshot();
  private _syncCount = 0;
  private _lastSyncAt = 0;

  constructor(store: Store<RootState>, config: StoreAudioBridgeConfig = {}) {
    this._store = store;
    this._scheduler =
      config.scheduler ??
      new TransportScheduler(new SchedulerReduxContext(store));
    this._verbose = config.verbose ?? defaultBridgeVerbose();

    this._emitter = new StoreAudioBridgeEmitter();

    this._transportSync = new TransportSync(
      this._scheduler,
      this._emitter,
      (msg, level) => this._log(msg, level)
    );

    this._initialSync = new InitialStateSync(this._emitter, (msg, level) =>
      this._log(msg, level)
    );
  }

  // ── Attach / Detach ────────────────────────────────────

  public attach(): void {
    if (this._isAttached) {
      this._log('attach() ignorado: ya está attached', 'warn');
      return;
    }

    try {
      this._initialSync.sync(this._store.getState());
      this._prev = takeTransportSnapshot(this._store.getState());

      this._unsubscribe = this._store.subscribe(() => {
        if (this._pendingSync) return;
        this._pendingSync = true;

        queueMicrotask(() => {
          this._pendingSync = false;
          if (this._isAttached) {
            this._handleStateChange();
          }
        });
      });

      this._isAttached = true;
      this._emitter.emit({ type: 'attached' });
      this._log('Attached');
    } catch (err) {
      const error = toBridgeError(err);
      this._log(`Error en attach: ${error.message}`, 'error');
      this._emitter.emit({ type: 'error', error });
      throw error;
    }
  }

  public detach(): void {
    if (!this._isAttached) return;

    try {
      this._unsubscribe?.();
      this._unsubscribe = null;

      this._transportSync.stopScheduler();

      this._isAttached = false;
      this._emitter.emit({ type: 'detached' });
      this._log('Detached');
    } catch (err) {
      const error = toBridgeError(err);
      this._log(`Error en detach: ${error.message}`, 'error');
      this._emitter.emit({ type: 'error', error });
    }
  }

  public dispose(): void {
    this.detach();
    this._emitter.clear();
  }

  // ── Re-sync ────────────────────────────────────────────

  public resync(): void {
    if (!this._isAttached) {
      this._log('resync() ignorado: no está attached', 'warn');
      return;
    }

    try {
      this._initialSync.sync(this._store.getState());
      this._prev = takeTransportSnapshot(this._store.getState());
      this._log('Re-sincronizado');
    } catch (err) {
      const error = toBridgeError(err);
      this._log(`Error en resync: ${error.message}`, 'error');
      this._emitter.emit({ type: 'error', error });
    }
  }

  // ── Diff loop ──────────────────────────────────────────

  private _handleStateChange(): void {
    const next = takeTransportSnapshot(this._store.getState());
    this._transportSync.applyDiff(this._prev, next);

    this._prev = next;
    this._syncCount += 1;
    this._lastSyncAt = Date.now();
  }

  // ── Events / stats ─────────────────────────────────────

  public on(listener: StoreAudioBridgeListener): () => void {
    return this._emitter.on(listener);
  }

  public getStats(): StoreAudioBridgeStats {
    return {
      isAttached: this._isAttached,
      isPlaying: this._prev.isPlaying,
      isRecording: this._prev.isRecording,
      syncCount: this._syncCount,
      lastSyncAt: this._lastSyncAt,
      schedulerRunning: this._scheduler.isRunning,
    };
  }

  public get isAttached(): boolean {
    return this._isAttached;
  }

  public get scheduler(): TransportScheduler {
    return this._scheduler;
  }

  // ── Logs ───────────────────────────────────────────────

  private _log(
    message: string,
    level: 'info' | 'warn' | 'error' = 'info'
  ): void {
    if (!this._verbose && level === 'info') return;

    switch (level) {
      case 'error':
        console.error(LOG_PREFIX, message);
        break;
      case 'warn':
        console.warn(LOG_PREFIX, message);
        break;
      default:
        console.info(LOG_PREFIX, message);
        break;
    }
  }
}