// src/audio/scheduling/LoopBounds.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 LoopBounds — Cálculo de límites del loop + cache
// --------------------------------------------------------------
// Calcula start/end del loop actual, con cache invalidado por
// referencia (ref-equality). Redux Toolkit usa Immer, así que si
// nada cambió en clips, la referencia es la misma y evitamos
// recalcular O(N) en cada tick.
// ═══════════════════════════════════════════════════════════════

import type { SchedulerSnapshot, SchedulerClip } from './SchedulerContext';

export class LoopBounds {
  // Cache: referencia del array de clips → contentEnd calculado
  private _cachedClipsRef: ReadonlyArray<SchedulerClip> | null = null;
  private _cachedContentEnd = 0;

  /**
   * Devuelve el end del loop.
   * - Si loop.enabled y loop.end > loop.start → loop.end
   * - Si no → contentEnd (fin del clip más lejano)
   */
  public getLoopEnd(snapshot: SchedulerSnapshot): number {
    const { loop } = snapshot;
    if (loop.enabled && loop.end > loop.start) return loop.end;
    return this._getContentEnd(snapshot.clips);
  }

  /**
   * Devuelve el start del loop.
   * - Si loop.enabled y loop.end > loop.start → loop.start
   * - Si no → 0
   */
  public getLoopStart(snapshot: SchedulerSnapshot): number {
    const { loop } = snapshot;
    if (loop.enabled && loop.end > loop.start) return loop.start;
    return 0;
  }

  /** Fin absoluto del contenido (última nota / clip). Cacheado. */
  public getContentEnd(snapshot: SchedulerSnapshot): number {
    return this._getContentEnd(snapshot.clips);
  }

  /**
   * Cache invalidado por referencia:
   * - Si el array de clips es la MISMA referencia → devolvemos cache
   * - Si es una nueva referencia → recalculamos O(N)
   *
   * Requisito: el SchedulerContext debe devolver la misma referencia
   * si nada cambió (contrato documentado en SchedulerContext).
   */
  private _getContentEnd(clips: ReadonlyArray<SchedulerClip>): number {
    if (clips === this._cachedClipsRef) {
      return this._cachedContentEnd;
    }

    let maxEnd = 0;
    for (const clip of clips) {
      const end = clip.startTime + clip.duration;
      if (end > maxEnd) maxEnd = end;
    }

    this._cachedClipsRef = clips;
    this._cachedContentEnd = maxEnd;
    return maxEnd;
  }

  /** Invalida el cache manualmente (útil para tests o forzar recálculo) */
  public invalidateCache(): void {
    this._cachedClipsRef = null;
    this._cachedContentEnd = 0;
  }

  /** Snapshot del contentEnd cacheado (para stats/debugging) */
  public get cachedContentEnd(): number {
    return this._cachedContentEnd;
  }
}