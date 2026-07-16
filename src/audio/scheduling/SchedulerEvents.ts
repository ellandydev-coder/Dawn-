// src/audio/scheduling/SchedulerEvents.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 Eventos que emite el TransportScheduler
// --------------------------------------------------------------
// Cualquier cliente (Redux, tests, UI, futuros plugins) puede
// suscribirse a estos eventos vía scheduler.on(listener).
// ═══════════════════════════════════════════════════════════════

export type TransportSchedulerEvent =
  | { type: 'started'; playheadSec: number }
  | { type: 'stopped'; finalPlayheadSec: number }
  | { type: 'paused'; playheadSec: number }
  | { type: 'resumed'; playheadSec: number }
  | { type: 'loopCompleted'; cycle: number }
  | { type: 'clipScheduled'; clipId: string; when: number }
  | { type: 'error'; error: Error };

export type TransportSchedulerListener = (
  event: TransportSchedulerEvent
) => void;

/**
 * Emisor de eventos con captura de errores por listener.
 * Un listener que falle no rompe los demás.
 */
export class SchedulerEventEmitter {
  private readonly _listeners = new Set<TransportSchedulerListener>();

  public on(listener: TransportSchedulerListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  public emit(event: TransportSchedulerEvent): void {
    // Snapshot para permitir unsubscribe durante el emit
    const snapshot = Array.from(this._listeners);
    for (const listener of snapshot) {
      try {
        listener(event);
      } catch (err) {
        console.error('[SchedulerEventEmitter] Error en listener:', err);
      }
    }
  }

  public clear(): void {
    this._listeners.clear();
  }
}