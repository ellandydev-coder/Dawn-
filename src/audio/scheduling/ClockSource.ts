/**
 * ClockSource
 * -----------
 * Reloj de alta precisión basado en AudioContext.currentTime.
 *
 * ¿Por qué no usar solo setInterval?
 * - setInterval tiene jitter de hasta 20ms en browsers modernos
 * - AudioContext.currentTime tiene precisión de sample (~0.02ms a 48kHz)
 *
 * Combinamos ambos:
 * - setTimeout dispara los ticks a intervalos regulares
 * - Cada tick pasa AudioContext.currentTime (precisión de sample)
 * - Los módulos usan ese time para agendar eventos futuros
 *
 * Uso básico:
 * ```typescript
 *   const clock = new ClockSource(audioContext);
 *   const off = clock.subscribe((time) => {
 *     console.log('Tick:', time);
 *   });
 *   clock.start();
 *
 *   // Al terminar
 *   off();
 *   clock.stop();
 * ```
 */

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export type ClockCallback = (currentTime: number) => void;

export interface ClockSourceConfig {
  /** Intervalo entre ticks en ms (default: 25) */
  intervalMs?: number;
  /** Habilitar logs (default: true en dev) */
  verbose?: boolean;
}

export interface ClockSourceStats {
  isRunning: boolean;
  isPaused: boolean;
  intervalMs: number;
  tickCount: number;
  subscriberCount: number;
  lastTickTime: number;
  averageDriftMs: number;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const DEFAULT_INTERVAL_MS = 25;
const DRIFT_HISTORY_SIZE = 20;

// ═══════════════════════════════════════════════════════════════
// 🎯 CLASE
// ═══════════════════════════════════════════════════════════════

export class ClockSource {
  private _context: AudioContext;
  private _intervalMs: number;
  private _verbose: boolean;

  private _isRunning = false;
  private _isPaused = false;
  private _timerId: number | null = null;

  private _subscribers = new Set<ClockCallback>();

  // Métricas
  private _tickCount = 0;
  private _lastTickTime = 0;
  private _expectedNextTickMs = 0;
  private _driftHistory: number[] = [];

  constructor(context: AudioContext, config: ClockSourceConfig | number = {}) {
    this._context = context;

    // Retrocompatibilidad: si pasan un número, es el intervalMs
    if (typeof config === 'number') {
      this._intervalMs = config;
      this._verbose = import.meta.env?.DEV ?? false;
    } else {
      this._intervalMs = config.intervalMs ?? DEFAULT_INTERVAL_MS;
      this._verbose = config.verbose ?? (import.meta.env?.DEV ?? false);
    }
  }

  // ─────────────────────────────────────────────
  // Suscripciones (múltiples callbacks)
  // ─────────────────────────────────────────────

  /**
   * Suscribe un callback al tick. Devuelve función para desuscribir.
   *
   * Múltiples suscriptores pueden coexistir.
   */
  public subscribe(callback: ClockCallback): () => void {
    this._subscribers.add(callback);
    this._log(`Suscriptor añadido (total: ${this._subscribers.size})`);
    return () => {
      this._subscribers.delete(callback);
      this._log(`Suscriptor eliminado (total: ${this._subscribers.size})`);
    };
  }

  /** Elimina todos los suscriptores */
  public clearSubscribers(): void {
    this._subscribers.clear();
  }

  // ─────────────────────────────────────────────
  // Control principal
  // ─────────────────────────────────────────────

  /**
   * Inicia el reloj.
   *
   * @param callback Opcional. Si se pasa, se suscribe automáticamente
   *                 (retrocompatibilidad con la API anterior).
   */
  public start(callback?: ClockCallback): void {
    if (this._isRunning) {
      this._log('start() ignorado: ya está corriendo', 'warn');
      return;
    }

    if (callback) {
      this.subscribe(callback);
    }

    this._isRunning = true;
    this._isPaused = false;
    this._expectedNextTickMs = performance.now() + this._intervalMs;
    this._tick();

    this._log(`Iniciado @ ${this._intervalMs}ms`);
  }

  /**
   * Detiene el reloj y limpia el timer.
   * No borra los suscriptores (usa clearSubscribers para eso).
   */
  public stop(): void {
    if (!this._isRunning && !this._isPaused) return;

    this._isRunning = false;
    this._isPaused = false;

    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }

    this._log('Detenido');
  }

  /** Pausa el reloj manteniendo los suscriptores */
  public pause(): void {
    if (!this._isRunning) return;

    this._isRunning = false;
    this._isPaused = true;

    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }

    this._log('Pausado');
  }

  /** Reanuda un reloj pausado */
  public resume(): void {
    if (!this._isPaused) return;

    this._isRunning = true;
    this._isPaused = false;
    this._expectedNextTickMs = performance.now() + this._intervalMs;
    this._tick();

    this._log('Reanudado');
  }

  /**
   * Fuerza un tick manual. Útil para testing o sincronización.
   */
  public tickNow(): void {
    this._executeCallbacks(this._context.currentTime);
  }

  // ─────────────────────────────────────────────
  // Configuración
  // ─────────────────────────────────────────────

  /**
   * Cambia el intervalo del reloj en runtime.
   *
   * Nota: renombrado de `setInterval` para evitar confusión con `window.setInterval`.
   */
  public setIntervalMs(ms: number): void {
    const clamped = Math.max(1, Math.floor(ms));
    if (this._intervalMs === clamped) return;

    this._intervalMs = clamped;
    this._log(`Intervalo cambiado a ${clamped}ms`);
  }

  /** @deprecated Usa setIntervalMs() para evitar confusión con window.setInterval */
  public setInterval(ms: number): void {
    this.setIntervalMs(ms);
  }

  public getIntervalMs(): number {
    return this._intervalMs;
  }

  // ─────────────────────────────────────────────
  // Estado y métricas
  // ─────────────────────────────────────────────

  public getStats(): ClockSourceStats {
    const avgDrift =
      this._driftHistory.length > 0
        ? this._driftHistory.reduce((a, b) => a + b, 0) / this._driftHistory.length
        : 0;

    return {
      isRunning: this._isRunning,
      isPaused: this._isPaused,
      intervalMs: this._intervalMs,
      tickCount: this._tickCount,
      subscriberCount: this._subscribers.size,
      lastTickTime: this._lastTickTime,
      averageDriftMs: avgDrift,
    };
  }

  public get currentTime(): number {
    return this._context.currentTime;
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  public get isPaused(): boolean {
    return this._isPaused;
  }

  public get subscriberCount(): number {
    return this._subscribers.size;
  }

  public get tickCount(): number {
    return this._tickCount;
  }

  // ─────────────────────────────────────────────
  // Internos
  // ─────────────────────────────────────────────

  private _tick(): void {
    if (!this._isRunning) return;

    const now = performance.now();
    const drift = now - this._expectedNextTickMs;

    // Registrar drift para métricas
    this._driftHistory.push(drift);
    if (this._driftHistory.length > DRIFT_HISTORY_SIZE) {
      this._driftHistory.shift();
    }

    // Ejecutar callbacks
    this._executeCallbacks(this._context.currentTime);

    // Programar siguiente tick con compensación de drift
    // (si nos retrasamos, el siguiente tick es más corto)
    const nextDelay = Math.max(1, this._intervalMs - drift);
    this._expectedNextTickMs = now + nextDelay;

    this._timerId = window.setTimeout(() => this._tick(), nextDelay);
  }

  private _executeCallbacks(currentTime: number): void {
    this._tickCount += 1;
    this._lastTickTime = currentTime;

    this._subscribers.forEach((callback) => {
      try {
        callback(currentTime);
      } catch (err) {
        this._log(
          `Error en callback: ${err instanceof Error ? err.message : err}`,
          'error'
        );
      }
    });
  }

  private _log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this._verbose && level === 'info') return;

    const prefix = '[ClockSource]';
    switch (level) {
      case 'error': console.error(prefix, msg); break;
      case 'warn':  console.warn(prefix, msg);  break;
      default:      console.info(prefix, msg);
    }
  }
}