// src/audio/scheduling/ClipScheduler.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 ClipScheduler — Agenda clips dentro de una ventana temporal
// ═══════════════════════════════════════════════════════════════

import { MIN_CLIP_DURATION_S } from './constants';
import { applyClipEnvelope } from './ClipEnvelope';
import type {
  ScheduledClipEntry,
  ScheduledClipsRegistry,
} from './ScheduledClipsRegistry';
import type { SchedulerContext, SchedulerClip } from './SchedulerContext';
import type { SchedulerEventEmitter } from './SchedulerEvents';

export interface ScheduleClipsWindowParams {
  readonly snapshot: ReturnType<SchedulerContext['getSnapshot']>;
  readonly windowStart: number;
  readonly windowEnd: number;
  readonly ctxNow: number;
  readonly loopCycle: number;
  readonly catchUpMidClips: boolean;
}

export class ClipScheduler {
  private readonly _context: SchedulerContext;
  private readonly _registry: ScheduledClipsRegistry;
  private readonly _events: SchedulerEventEmitter;
  private readonly _log: (msg: string, level?: 'info' | 'warn' | 'error') => void;

  constructor(
    context: SchedulerContext,
    registry: ScheduledClipsRegistry,
    events: SchedulerEventEmitter,
    log: (msg: string, level?: 'info' | 'warn' | 'error') => void
  ) {
    this._context = context;
    this._registry = registry;
    this._events = events;
    this._log = log;
  }

  public scheduleWindow(params: ScheduleClipsWindowParams): void {
    const { snapshot, windowStart, windowEnd, ctxNow, loopCycle, catchUpMidClips } = params;

    if (!this._registry.canScheduleMore()) {
      this._log(
        `Límite de clips agendados alcanzado (${this._registry.size})`,
        'warn'
      );
      return;
    }

    for (const clip of snapshot.clips) {
      if (!clip.assetId) continue;

      const scheduleKey = `${clip.id}__cycle${loopCycle}`;
      if (this._registry.has(scheduleKey)) continue;

      const clipStart = clip.startTime;
      const clipEnd = clip.startTime + clip.duration;

      // ── CASO 1: clip empieza dentro de la ventana ───────────
      if (clipStart >= windowStart && clipStart < windowEnd) {
        this._scheduleClip({
          scheduleKey,
          clip,
          timelinePos: clipStart,
          timelineNow: windowStart,
          ctxNow,
          playbackOffset: 0,
          duration: clip.duration,
        });
        continue;
      }

      // ── CASO 2: mid-clip catch-up ───────────────────────────
      if (catchUpMidClips && clipStart < windowStart && clipEnd > windowStart) {
        const playbackOffset = windowStart - clipStart;
        const remaining = clip.duration - playbackOffset;
        if (remaining > MIN_CLIP_DURATION_S) {
          this._scheduleClip({
            scheduleKey,
            clip,
            timelinePos: windowStart,
            timelineNow: windowStart,
            ctxNow,
            playbackOffset,
            duration: remaining,
          });
        }
      }
    }
  }

  private _scheduleClip(args: {
    scheduleKey: string;
    clip: SchedulerClip;
    timelinePos: number;
    timelineNow: number;
    ctxNow: number;
    playbackOffset: number;
    duration: number;
  }): void {
    const { scheduleKey, clip, timelinePos, timelineNow, ctxNow, playbackOffset, duration } = args;

    if (!clip.assetId) return;

    // ── 1. Resolver assets y nodos ──────────────────────────
    const buffer = this._context.getAsset(clip.assetId);
    if (!buffer) {
      this._log(`Asset "${clip.assetId}" no encontrado`, 'warn');
      return;
    }

    const trackNode = this._context.getTrackNode(clip.trackId);
    if (!trackNode) {
      this._log(`Track "${clip.trackId}" no encontrada`, 'warn');
      return;
    }

    // ── 2. Calcular offset y duración efectivos ─────────────
    const totalSourceOffset = Math.max(0, (clip.offset ?? 0) + playbackOffset);
    const availableBufferDuration = Math.max(0, buffer.duration - totalSourceOffset);
    const safeDuration = Math.min(duration, availableBufferDuration);

    if (safeDuration < MIN_CLIP_DURATION_S) {
      this._log(
        `Clip ${scheduleKey} muy corto tras offset (${safeDuration.toFixed(4)}s), ignorado`,
        'warn'
      );
      return;
    }

    // ── 3. Calcular timing ──────────────────────────────────
    const when = ctxNow + (timelinePos - timelineNow);
    const startAt = Math.max(ctxNow, when);

    try {
      // ── 4. Crear nodos ────────────────────────────────────
      // Usa el contexto, no el singleton global
      const ctx = this._context.getAudioContext();
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const clipGain = ctx.createGain();

      // source → clipGain → trackNode.input
      source.connect(clipGain);
      clipGain.connect(trackNode.input);

      // ── 5. Aplicar envelope ───────────────────────────────
      applyClipEnvelope({
        param: clipGain.gain,
        startAt,
        playedDuration: safeDuration,
        clipGain: clip.gain ?? 1,
        fadeIn: clip.fadeIn ?? 0,
        fadeOut: clip.fadeOut ?? 0,
        playbackOffset,
        originalDuration: clip.duration,
      });

      // ── 6. Arrancar ───────────────────────────────────────
      source.start(startAt, totalSourceOffset, safeDuration);

      // ── 7. Registrar ──────────────────────────────────────
      const entry: ScheduledClipEntry = {
        scheduleKey,
        clipId: clip.id,
        source,
        clipGain,
        scheduledAt: startAt,
        clipDuration: safeDuration,
      };

      this._registry.register(entry);

      this._events.emit({
        type: 'clipScheduled',
        clipId: scheduleKey,
        when: startAt,
      });
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._log(`Error agendando clip: ${error.message}`, 'error');
      this._events.emit({ type: 'error', error });
    }
  }
}