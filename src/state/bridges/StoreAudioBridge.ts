// src/state/bridges/StoreAudioBridge.ts

import type { Store } from '@reduxjs/toolkit';
import { audioEngine } from '@audio/engine/AudioEngine';
import { TransportScheduler } from '@audio/scheduling/TransportScheduler';
import type { RootState } from '@state/store';
import { SchedulerReduxContext } from './SchedulerReduxContext';

/**
 * StoreAudioBridge
 * ----------------
 * Puente ligero entre Redux y el motor de audio.
 *
 * Responsabilidades:
 * - Escuchar cambios de transport (isPlaying) → start/stop scheduler
 * - Escuchar seeks → aplicar al scheduler
 * - Sincronizar estado inicial al conectar
 * - Permitir re-sincronización manual
 * - Detectar cambios de recording → sync con scheduler
 *
 * NO se ocupa de:
 * - Cambios de volumen/pan/mute (eso lo hace audioSyncMiddleware)
 * - Crear efectos, sends, etc. (eso lo hacen listeners específicos)
 *
 * Diseño:
 * - Usa store.subscribe() con diff mínimo para transport state
 * - La mayoría de la sincronización es reactiva vía middleware
 * - queueMicrotask evita recursión cuando el scheduler dispatchea
 * - El TransportScheduler recibe un SchedulerContext (Redux) por
 *   inversión de dependencia (el motor no conoce Redux directamente)
 */

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface StoreAudioBridgeConfig {
  /** Habilitar logs (default: true en dev) */
  verbose?: boolean;
  /** Scheduler custom (útil para testing) */
  scheduler?: TransportScheduler;
}

export interface StoreAudioBridgeStats {
  isAttached: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  syncCount: number;
  lastSyncAt: number;
  schedulerRunning: boolean;
}

export type StoreAudioBridgeEvent =
  | { type: 'attached' }
  | { type: 'detached' }
  | { type: 'initialStateSynced'; trackCount: number }
  | { type: 'transportChanged'; isPlaying: boolean; isRecording: boolean }
  | { type: 'seekApplied'; toSec: number }
  | { type: 'loopChanged'; enabled: boolean; start: number; end: number }
  | { type: 'error'; error: Error };

export type StoreAudioBridgeListener = (event: StoreAudioBridgeEvent) => void;

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

const LOG_PREFIX = '[StoreAudioBridge]';

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

// ═══════════════════════════════════════════════════════════════
// 🎯 SNAPSHOT DE TRANSPORT (campos que observamos con diff)
// ═══════════════════════════════════════════════════════════════

interface TransportSnapshot {
  isPlaying: boolean;
  isRecording: boolean;
  editCursorSeconds: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
}

function takeTransportSnapshot(state: RootState): TransportSnapshot {
  return {
    isPlaying: state.transport.isPlaying,
    isRecording: state.transport.isRecording,
    editCursorSeconds: state.transport.editCursorSeconds,
    loopEnabled: state.transport.loopEnabled,
    loopStart: state.transport.loopStart,
    loopEnd: state.transport.loopEnd,
  };
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CLASE
// ═══════════════════════════════════════════════════════════════

export class StoreAudioBridge {
  private readonly _store: Store<RootState>;
  private readonly _scheduler: TransportScheduler;
  private readonly _verbose: boolean;

  private _unsubscribe: (() => void) | null = null;
  private _isAttached = false;
  private _pendingSync = false;

  // Snapshot previo para diff
  private _prev: TransportSnapshot = {
    isPlaying: false,
    isRecording: false,
    editCursorSeconds: 0,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: 0,
  };

  // Métricas
  private _syncCount = 0;
  private _lastSyncAt = 0;

  // Listeners de eventos
  private readonly _listeners = new Set<StoreAudioBridgeListener>();

  constructor(store: Store<RootState>, config: StoreAudioBridgeConfig = {}) {
    this._store = store;
    // Inversión de dependencia: el scheduler recibe un contexto
    // que sabe cómo leer del store y despachar. El scheduler NO
    // conoce Redux directamente.
    this._scheduler =
      config.scheduler ??
      new TransportScheduler(new SchedulerReduxContext(store));
    this._verbose = config.verbose ?? Boolean(import.meta.env?.DEV);
  }

  // ═══════════════════════════════════
  // Attach / Detach
  // ═══════════════════════════════════

  /**
   * Conecta el puente al store.
   * Aplica el estado inicial y comienza a escuchar cambios.
   */
  public attach(): void {
    if (this._isAttached) {
      this._log('attach() ignorado: ya está attached', 'warn');
      return;
    }

    try {
      this._syncInitialState();

      // Snapshot inicial de referencia
      this._prev = takeTransportSnapshot(this._store.getState());

      // Suscripción con coalescing via microtask
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
      this._emit({ type: 'attached' });
      this._log('Attached');
    } catch (err) {
      const error = toError(err);
      this._log(`Error en attach: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
      throw error;
    }
  }

  /**
   * Desconecta el puente del store y detiene el scheduler.
   */
  public detach(): void {
    if (!this._isAttached) return;

    try {
      this._unsubscribe?.();
      this._unsubscribe = null;

      this._scheduler.stop();

      this._isAttached = false;
      this._emit({ type: 'detached' });
      this._log('Detached');
    } catch (err) {
      const error = toError(err);
      this._log(`Error en detach: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
    }
  }

  /**
   * Desconecta y limpia todos los listeners.
   * Llamar al destruir la instancia (cleanup de AudioProvider, etc.).
   */
  public dispose(): void {
    this.detach();
    this._listeners.clear();
  }

  // ═══════════════════════════════════
  // Re-sync manual
  // ═══════════════════════════════════

  /**
   * Re-sincroniza el estado del motor con el store.
   * Útil después de cargar un proyecto o cambios masivos.
   */
  public resync(): void {
    if (!this._isAttached) {
      this._log('resync() ignorado: no está attached', 'warn');
      return;
    }

    try {
      this._syncInitialState();
      this._prev = takeTransportSnapshot(this._store.getState());
      this._log('Re-sincronizado');
    } catch (err) {
      const error = toError(err);
      this._log(`Error en resync: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
    }
  }

  // ═══════════════════════════════════
  // Handler de cambios (diff mínimo)
  // ═══════════════════════════════════

  private _handleStateChange(): void {
    const state = this._store.getState();
    const next = takeTransportSnapshot(state);
    const prev = this._prev;

    // ── Transport play/stop/record
    if (
      next.isPlaying !== prev.isPlaying ||
      next.isRecording !== prev.isRecording
    ) {
      this._handleTransportChange(next.isPlaying, next.isRecording);
    }

    // ── Edit cursor (seek)
    if (next.editCursorSeconds !== prev.editCursorSeconds) {
      this._handleSeek(next.editCursorSeconds, next.isPlaying);
    }

    // ── Loop range
    if (
      next.loopEnabled !== prev.loopEnabled ||
      next.loopStart !== prev.loopStart ||
      next.loopEnd !== prev.loopEnd
    ) {
      this._handleLoopChange(next.loopEnabled, next.loopStart, next.loopEnd);
    }

    // Actualizar snapshot
    this._prev = next;
    this._syncCount += 1;
    this._lastSyncAt = Date.now();
  }

  private _handleTransportChange(
    isPlaying: boolean,
    isRecording: boolean
  ): void {
    if (isPlaying || isRecording) {
      this._scheduler.start();
    } else {
      this._scheduler.stop();
    }

    this._emit({ type: 'transportChanged', isPlaying, isRecording });

    const status = isRecording
      ? 'recording'
      : isPlaying
        ? 'playing'
        : 'stopped';
    this._log(`Transport → ${status}`);
  }

  private _handleSeek(editCursorSeconds: number, isPlaying: boolean): void {
    // Solo aplicar seek al scheduler si está reproduciendo.
    // Si está detenido, el cursor de edición se refleja directamente en la UI.
    if (isPlaying) {
      this._scheduler.seekTo(editCursorSeconds);
      this._emit({ type: 'seekApplied', toSec: editCursorSeconds });
      this._log(`Seek → ${editCursorSeconds.toFixed(3)}s`);
    }
  }

  private _handleLoopChange(
    enabled: boolean,
    start: number,
    end: number
  ): void {
    // El scheduler usa el estado del store directamente,
    // pero emitimos el evento para que otros sistemas puedan reaccionar.
    this._emit({ type: 'loopChanged', enabled, start, end });
    this._log(
      enabled
        ? `Loop ON: ${start.toFixed(2)}s → ${end.toFixed(2)}s`
        : 'Loop OFF'
    );
  }

  // ═══════════════════════════════════
  // Sincronización inicial
  // ═══════════════════════════════════

  /**
   * Refleja el estado actual de Redux en los nodos de audio.
   * Se llama en attach() y en resync().
   */
  private _syncInitialState(): void {
    if (!audioEngine.isInitialized) {
      this._log('_syncInitialState ignorado: engine no inicializado', 'warn');
      return;
    }

    const state = this._store.getState();

    // Master
    audioEngine.setMasterVolume(state.mixer.global.masterVolume);
    audioEngine.setMuted(state.mixer.global.masterMuted);

    // Tracks
    let syncedTracks = 0;
    const anySoloed = state.tracks.allIds.some(
      (id) => state.tracks.byId[id]?.soloed === true
    );

    for (const id of state.tracks.allIds) {
      const track = state.tracks.byId[id];
      if (!track) continue;

      try {
        const node = audioEngine.routingGraph.createTrack(id);
        node.setVolume(track.volume);
        node.setPan(track.pan);

        // Aplicar lógica de mute/solo correctamente
        const shouldMute = anySoloed
          ? !track.soloed || track.muted
          : track.muted;
        node.setMuted(shouldMute);

        syncedTracks += 1;
      } catch (err) {
        this._log(`Error sincronizando track ${id}: ${err}`, 'warn');
      }
    }

    this._emit({ type: 'initialStateSynced', trackCount: syncedTracks });
    this._log(`Estado inicial sincronizado: ${syncedTracks} tracks`);
  }

  // ═══════════════════════════════════
  // Sistema de eventos
  // ═══════════════════════════════════

  /**
   * Suscribe un listener a eventos del bridge.
   * @returns función de desuscripción
   */
  public on(listener: StoreAudioBridgeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _emit(event: StoreAudioBridgeEvent): void {
    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(LOG_PREFIX, 'Error en listener:', err);
      }
    }
  }

  // ═══════════════════════════════════
  // Estado y métricas
  // ═══════════════════════════════════

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

  // ═══════════════════════════════════
  // Logs
  // ═══════════════════════════════════

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