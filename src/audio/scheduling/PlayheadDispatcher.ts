// src/audio/scheduling/PlayheadDispatcher.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 PlayheadDispatcher — Envío throttled del playhead al cliente
// --------------------------------------------------------------
// Envía el playhead al SchedulerContext (que normalmente lo mete
// en Redux). Aplica 2 optimizaciones:
//
//   1. Coalesce con queueMicrotask: si se llama varias veces en
//      la misma tarea, solo se dispatcha una vez al final.
//
//   2. Skip si el valor no cambió lo suficiente (epsilon).
//      Evita dispatchs redundantes durante pausa/estados estáticos
//      y reduce presión sobre el middleware de audio.
// ═══════════════════════════════════════════════════════════════

import { PLAYHEAD_DISPATCH_EPSILON } from './constants';

export class PlayheadDispatcher {
  private readonly _onPlayheadChange: (seconds: number) => void;
  private readonly _computePlayhead: () => number;
  private readonly _isRunning: () => boolean;

  private _lastDispatched = -Infinity;
  private _pending = false;

  constructor(
    onPlayheadChange: (seconds: number) => void,
    computePlayhead: () => number,
    isRunning: () => boolean
  ) {
    this._onPlayheadChange = onPlayheadChange;
    this._computePlayhead = computePlayhead;
    this._isRunning = isRunning;
  }

  /**
   * Notifica al cliente del playhead actual (throttled + coalesced).
   * Se llama desde el UI timer (~30 FPS).
   */
  public dispatch(): void {
    if (!this._isRunning()) return;

    const newPlayhead = this._computePlayhead();

    // Skip si el valor no cambió significativamente
    if (
      Math.abs(newPlayhead - this._lastDispatched) < PLAYHEAD_DISPATCH_EPSILON
    ) {
      return;
    }

    if (this._pending) return;
    this._pending = true;

    queueMicrotask(() => {
      this._pending = false;
      // Verificar de nuevo — pudo haberse llamado stop() entre medias
      if (!this._isRunning()) return;

      const latest = this._computePlayhead();
      this._lastDispatched = latest;
      this._onPlayheadChange(Math.max(0, latest));
    });
  }

  /**
   * Dispatch síncrono e incondicional (fuera de throttle).
   * Se usa al parar el scheduler para asegurar que la UI queda
   * en la posición final.
   */
  public dispatchImmediate(seconds: number): void {
    this._lastDispatched = seconds;
    this._onPlayheadChange(Math.max(0, seconds));
  }

  /** Resetea el throttle (usado en seek/start) */
  public reset(): void {
    this._lastDispatched = -Infinity;
    this._pending = false;
  }
}