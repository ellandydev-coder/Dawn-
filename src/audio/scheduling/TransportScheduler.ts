// src/audio/scheduling/TransportScheduler.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 TransportScheduler — Orquestador del sistema de scheduling
// ═══════════════════════════════════════════════════════════════

import {
  LOOKAHEAD_MS,
  SCHEDULE_AHEAD_S,
  UI_UPDATE_MS,
  LOOP_EPSILON,
  LOG_PREFIX,
} from './constants';
import { SchedulerClock } from './SchedulerClock';
import { LoopBounds } from './LoopBounds';
import { ClipScheduler } from './ClipScheduler';
import { ScheduledClipsRegistry } from './ScheduledClipsRegistry';
import { PlayheadDispatcher } from './PlayheadDispatcher';
import {
  SchedulerEventEmitter,
  type TransportSchedulerListener,
} from './SchedulerEvents';
import type { SchedulerContext } from './SchedulerContext';

export interface TransportSchedulerConfig {
  verbose?: boolean;
  uiUpdateMs?: number;
  useOutputTimeForPlayhead?: boolean;
}

export interface TransportSchedulerStats {
  isRunning: boolean;
  isPaused: boolean;
  scheduledClipsCount: number;
  currentLoopCycle: number;
  cycleStartTimelineSec: number;
  cycleStartCtxTime: number;
  driftMs: number;
  cachedContentEndSec: number;
}

export class TransportScheduler {
  private readonly _context: SchedulerContext;
  private readonly _config: Required<TransportSchedulerConfig>;

  private readonly _clock: SchedulerClock;
  private readonly _loopBounds: LoopBounds;
  private readonly _registry: ScheduledClipsRegistry;
  private readonly _clipScheduler: ClipScheduler;
  private readonly _playheadDispatcher: PlayheadDispatcher;
  private readonly _events: SchedulerEventEmitter;

  private _isRunning = false;
  private _isPaused = false;
  private _timerId: number | null = null;
  private _uiTimerId: number | null = null;
  private _pausedAtTimelineSec = 0;
  private _needsMidClipCatchUp = false;

  constructor(context: SchedulerContext, config: TransportSchedulerConfig = {}) {
    this._context = context;
    this._config = {
      verbose: import.meta.env?.DEV ?? false,
      uiUpdateMs: UI_UPDATE_MS,
      useOutputTimeForPlayhead: true,
      ...config,
    };

    this._events = new SchedulerEventEmitter();
    this._registry = new ScheduledClipsRegistry();
    this._loopBounds = new LoopBounds();

    // ── Reloj usa el contexto, no el singleton global ──────────
    this._clock = new SchedulerClock(
      {
        get currentTime() { return context.getAudioCurrentTime(); },
        get audioOutputTime() { return context.getAudioOutputTime(); },
      },
      { useOutputTimeForPlayhead: this._config.useOutputTimeForPlayhead }
    );

    this._clipScheduler = new ClipScheduler(
      this._context,
      this._registry,
      this._events,
      (msg, level) => this._log(msg, level)
    );

    this._playheadDispatcher = new PlayheadDispatcher(
      (seconds) => this._context.onPlayheadChange(seconds),
      () => this._clock.computeCurrentPlayhead(),
      () => this._isRunning
    );
  }

  // ═══════════════════════════════════════════
  // Control principal
  // ═══════════════════════════════════════════

  public start(): void {
    if (this._isRunning) return;

    // Guard — usa el contexto, no audioEngine directamente
    if (!this._context.isAudioReady()) {
      this._log('start() ignorado: engine no inicializado', 'warn');
      return;
    }

    const startPos = this._isPaused
      ? this._pausedAtTimelineSec
      : this._clock.cycleStartTimelineSec;

    this._clock.resetCycle(startPos);
    this._clock.resetLoopCycle();
    this._needsMidClipCatchUp = true;
    this._isRunning = true;

    const wasPaused = this._isPaused;
    this._isPaused = false;

    this._playheadDispatcher.reset();

    this._scheduleLoop();
    this._uiTimerId = window.setInterval(
      () => this._playheadDispatcher.dispatch(),
      this._config.uiUpdateMs
    );

    if (wasPaused) {
      this._events.emit({ type: 'resumed', playheadSec: startPos });
      this._log(`Resumido en ${startPos.toFixed(3)}s`);
    } else {
      this._events.emit({ type: 'started', playheadSec: startPos });
      this._log(`Iniciado en ${startPos.toFixed(3)}s`);
    }
  }

  public stop(): void {
    if (!this._isRunning) return;

    this._isRunning = false;
    this._isPaused = false;
    this._clearTimers();

    const finalPlayhead = this._clock.computeCurrentPlayhead();
    this._registry.stopAll();

    queueMicrotask(() => {
      this._playheadDispatcher.dispatchImmediate(Math.max(0, finalPlayhead));
    });

    this._events.emit({ type: 'stopped', finalPlayheadSec: finalPlayhead });
    this._log(`Detenido en ${finalPlayhead.toFixed(3)}s`);
  }

  public pause(): void {
    if (!this._isRunning) return;

    this._pausedAtTimelineSec = this._clock.computeCurrentPlayhead();
    this._isRunning = false;
    this._isPaused = true;
    this._clearTimers();
    this._registry.stopAll();

    this._events.emit({ type: 'paused', playheadSec: this._pausedAtTimelineSec });
    this._log(`Pausado en ${this._pausedAtTimelineSec.toFixed(3)}s`);
  }

  public seekTo(timelineSec: number): void {
    const clamped = Math.max(0, timelineSec);

    if (!this._isRunning) {
      this._pausedAtTimelineSec = clamped;
      this._playheadDispatcher.dispatchImmediate(clamped);
      return;
    }

    this._registry.stopAll();
    this._clock.resetCycle(clamped);
    this._clock.resetLoopCycle();
    this._needsMidClipCatchUp = true;
    this._playheadDispatcher.reset();

    this._playheadDispatcher.dispatchImmediate(clamped);
    this._log(`Seek a ${clamped.toFixed(3)}s`);
  }

  // ═══════════════════════════════════════════
  // Eventos
  // ═══════════════════════════════════════════

  public on(listener: TransportSchedulerListener): () => void {
    return this._events.on(listener);
  }

  // ═══════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════

  public getStats(): TransportSchedulerStats {
    return {
      isRunning: this._isRunning,
      isPaused: this._isPaused,
      scheduledClipsCount: this._registry.size,
      currentLoopCycle: this._clock.loopCycle,
      cycleStartTimelineSec: this._clock.cycleStartTimelineSec,
      cycleStartCtxTime: this._clock.cycleStartCtxTime,
      // usa el contexto, no el singleton
      driftMs: this._context.isAudioReady()
        ? this._clock.computeDriftMs()
        : 0,
      cachedContentEndSec: this._loopBounds.cachedContentEnd,
    };
  }

  public get isRunning(): boolean { return this._isRunning; }
  public get isPaused(): boolean { return this._isPaused; }

  public getScheduledClipIds(): readonly string[] {
    return this._registry.getScheduledKeys();
  }

  // ═══════════════════════════════════════════
  // Bucle principal
  // ═══════════════════════════════════════════

  private _scheduleLoop(): void {
    if (!this._isRunning) return;

    try {
      const snapshot = this._context.getSnapshot();
      const ctxNow = this._clock.ctxNow;

      const timelineNow = this._clock.computeInternalPlayhead();
      const timelineWindowEnd = timelineNow + SCHEDULE_AHEAD_S;

      if (snapshot.loop.enabled) {
        const loopStart = this._loopBounds.getLoopStart(snapshot);
        const loopEnd = this._loopBounds.getLoopEnd(snapshot);

        if (loopEnd > 0 && timelineNow >= loopEnd - LOOP_EPSILON) {
          this._clock.resetCycle(loopStart);
          this._clock.incrementLoopCycle();
          this._needsMidClipCatchUp = true;

          this._events.emit({ type: 'loopCompleted', cycle: this._clock.loopCycle });
          this._log(`Loop completado (ciclo #${this._clock.loopCycle})`);

          this._timerId = window.setTimeout(
            () => this._scheduleLoop(),
            LOOKAHEAD_MS
          );
          return;
        }

        const effectiveEnd =
          loopEnd > 0
            ? Math.min(timelineWindowEnd, loopEnd)
            : timelineWindowEnd;

        this._clipScheduler.scheduleWindow({
          snapshot,
          windowStart: timelineNow,
          windowEnd: effectiveEnd,
          ctxNow,
          loopCycle: this._clock.loopCycle,
          catchUpMidClips: this._needsMidClipCatchUp,
        });
      } else {
        this._clipScheduler.scheduleWindow({
          snapshot,
          windowStart: timelineNow,
          windowEnd: timelineWindowEnd,
          ctxNow,
          loopCycle: 0,
          catchUpMidClips: this._needsMidClipCatchUp,
        });
      }

      if (this._needsMidClipCatchUp) {
        this._needsMidClipCatchUp = false;
      }

      this._registry.cleanupFinished(ctxNow);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._log(`Error en scheduleLoop: ${error.message}`, 'error');
      this._events.emit({ type: 'error', error });
    }

    this._timerId = window.setTimeout(
      () => this._scheduleLoop(),
      LOOKAHEAD_MS
    );
  }

  // ═══════════════════════════════════════════
  // Privados
  // ═══════════════════════════════════════════

  private _clearTimers(): void {
    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }
    if (this._uiTimerId !== null) {
      clearInterval(this._uiTimerId);
      this._uiTimerId = null;
    }
  }

  private _log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this._config.verbose && level === 'info') return;
    switch (level) {
      case 'error': console.error(LOG_PREFIX, msg); break;
      case 'warn':  console.warn(LOG_PREFIX, msg);  break;
      default:      console.info(LOG_PREFIX, msg);
    }
  }
}