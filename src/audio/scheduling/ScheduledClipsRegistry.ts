// src/audio/scheduling/ScheduledClipsRegistry.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 ScheduledClipsRegistry — Registro + cleanup de clips agendados
// --------------------------------------------------------------
// Mantiene el mapa de clips actualmente agendados en el AudioContext.
// Encapsula:
//   • Registro por scheduleKey (clipId + cycle)
//   • Auto-cleanup vía onended
//   • Cleanup manual por tiempo (clips ya terminados)
//   • Stop de todos los sources (en stop/pause/seek)
//   • Límite defensivo contra crecimiento infinito
// ═══════════════════════════════════════════════════════════════

import { CLEANUP_MARGIN_S, MAX_SCHEDULED_CLIPS } from './constants';

export interface ScheduledClipEntry {
  /** Clave única (clipId + cycleId) */
  readonly scheduleKey: string;
  /** ID del clip original en el store */
  readonly clipId: string;
  /** Nodo source de Web Audio */
  readonly source: AudioBufferSourceNode;
  /** GainNode con envelope (fades) y gain del clip */
  readonly clipGain: GainNode;
  /** Tiempo AudioContext en el que arranca */
  readonly scheduledAt: number;
  /** Duración efectiva (segundos) del segmento reproducido */
  readonly clipDuration: number;
}

export class ScheduledClipsRegistry {
  private readonly _scheduled = new Map<string, ScheduledClipEntry>();

  // ═══════════════════════════════════════════
  // Registro
  // ═══════════════════════════════════════════

  /** ¿Ya existe un clip con esta clave? */
  public has(scheduleKey: string): boolean {
    return this._scheduled.has(scheduleKey);
  }

  /** Añade un clip al registro con auto-cleanup vía onended */
  public register(entry: ScheduledClipEntry): void {
    // Auto-limpieza cuando termina
    entry.source.onended = () => {
      try {
        entry.source.disconnect();
        entry.clipGain.disconnect();
      } catch {
        /* ignore */
      }
      this._scheduled.delete(entry.scheduleKey);
    };

    this._scheduled.set(entry.scheduleKey, entry);
  }

  // ═══════════════════════════════════════════
  // Consultas
  // ═══════════════════════════════════════════

  public get size(): number {
    return this._scheduled.size;
  }

  /**
   * ¿Se puede agendar más clips?
   * Protección contra crecimiento infinito del map.
   */
  public canScheduleMore(): boolean {
    return this._scheduled.size < MAX_SCHEDULED_CLIPS;
  }

  public getScheduledKeys(): readonly string[] {
    return Array.from(this._scheduled.keys());
  }

  // ═══════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════

  /**
   * Limpia clips que ya terminaron (con margen).
   * Se llama en cada tick del scheduler.
   */
  public cleanupFinished(ctxNow: number): void {
    for (const [key, sc] of this._scheduled) {
      const endedAt = sc.scheduledAt + sc.clipDuration;
      if (endedAt < ctxNow - CLEANUP_MARGIN_S) {
        try {
          sc.source.disconnect();
          sc.clipGain.disconnect();
        } catch {
          /* ignore */
        }
        this._scheduled.delete(key);
      }
    }
  }

  /**
   * Detiene TODOS los sources y limpia el registro.
   * Se usa en stop(), pause(), seekTo().
   */
  public stopAll(): void {
    for (const sc of this._scheduled.values()) {
      try {
        sc.source.stop();
      } catch {
        /* ya parado */
      }
      try {
        sc.source.disconnect();
      } catch {
        /* ignore */
      }
      try {
        sc.clipGain.disconnect();
      } catch {
        /* ignore */
      }
    }
    this._scheduled.clear();
  }
}