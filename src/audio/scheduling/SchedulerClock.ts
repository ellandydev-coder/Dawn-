// src/audio/scheduling/SchedulerClock.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 SchedulerClock — Reloj musical + cálculo de playhead
// --------------------------------------------------------------
// Encapsula el timing del scheduler:
//   • Marca el inicio del ciclo (ctx time + timeline time)
//   • Calcula el playhead actual (con o sin outputTime latency)
//   • Reset del ciclo (por seek, loop, etc.)
//
// Sin dependencias de Redux. Solo necesita el AudioContext.
// ═══════════════════════════════════════════════════════════════

export interface SchedulerClockConfig {
  /**
   * Usar `audioOutputTime` (con latencia de salida) para el playhead visual.
   * REAPER-style: el playhead coincide con lo que oyes, no con
   * lo que el motor está procesando. (default: true)
   */
  useOutputTimeForPlayhead?: boolean;
}

/**
 * Fuente de tiempo del AudioContext.
 * Abstraemos para poder testear sin AudioContext real.
 */
export interface AudioTimeSource {
  readonly currentTime: number;      // AudioContext.currentTime
  readonly audioOutputTime: number;  // AudioContext.getOutputTimestamp().contextTime (fallback: currentTime)
}

export class SchedulerClock {
  private readonly _timeSource: AudioTimeSource;
  private readonly _useOutputTime: boolean;

  private _cycleStartCtxTime = 0;
  private _cycleStartTimelineSec = 0;
  private _loopCycle = 0;

  constructor(
    timeSource: AudioTimeSource,
    config: SchedulerClockConfig = {}
  ) {
    this._timeSource = timeSource;
    this._useOutputTime = config.useOutputTimeForPlayhead ?? true;
  }

  // ═══════════════════════════════════════════
  // Reset del ciclo
  // ═══════════════════════════════════════════

  /**
   * Marca el inicio de un nuevo ciclo desde una posición del timeline.
   * Se usa en start(), seekTo(), y al reiniciar un loop.
   */
  public resetCycle(timelinePos: number): void {
    this._cycleStartCtxTime = this._timeSource.currentTime;
    this._cycleStartTimelineSec = Math.max(0, timelinePos);
  }

  /** Incrementa el contador de ciclos de loop */
  public incrementLoopCycle(): void {
    this._loopCycle += 1;
  }

  /** Resetea el contador de ciclos (usado en start desde cero) */
  public resetLoopCycle(): void {
    this._loopCycle = 0;
  }

  // ═══════════════════════════════════════════
  // Consultas
  // ═══════════════════════════════════════════

  /** Tiempo actual del AudioContext (para scheduling interno) */
  public get ctxNow(): number {
    return this._timeSource.currentTime;
  }

  /** Tiempo del ciclo en el AudioContext */
  public get cycleStartCtxTime(): number {
    return this._cycleStartCtxTime;
  }

  /** Posición del timeline donde empezó el ciclo actual */
  public get cycleStartTimelineSec(): number {
    return this._cycleStartTimelineSec;
  }

  /** Ciclo de loop actual (0 = primer pase) */
  public get loopCycle(): number {
    return this._loopCycle;
  }

  /**
   * Calcula el playhead actual.
   * - Para el playhead visual: usa `audioOutputTime` (latencia de salida)
   * - Para scheduling interno: usar `computeInternalPlayhead()` en su lugar
   */
  public computeCurrentPlayhead(): number {
    const ctxTime = this._useOutputTime
      ? this._timeSource.audioOutputTime
      : this._timeSource.currentTime;

    const elapsed = ctxTime - this._cycleStartCtxTime;
    return this._cycleStartTimelineSec + elapsed;
  }

  /**
   * Calcula el playhead INTERNO (sin latencia de output).
   * Se usa para saber qué agendar en la ventana del lookahead.
   */
  public computeInternalPlayhead(): number {
    const elapsed = this._timeSource.currentTime - this._cycleStartCtxTime;
    return this._cycleStartTimelineSec + elapsed;
  }

  /**
   * Drift (ms) entre el tiempo del contexto esperado y el real.
   * Útil para debugging de precisión.
   */
  public computeDriftMs(): number {
    const currentPlayhead = this.computeCurrentPlayhead();
    const expectedCtxTime =
      this._cycleStartCtxTime + (currentPlayhead - this._cycleStartTimelineSec);
    return (this._timeSource.currentTime - expectedCtxTime) * 1000;
  }
}