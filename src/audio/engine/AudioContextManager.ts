/**
 * AudioContextManager
 * -------------------
 * Singleton que gestiona el AudioContext global de la aplicación.
 *
 * ¿Por qué singleton?
 * - Los navegadores limitan la cantidad de AudioContexts activos (típicamente 6)
 * - Compartir un solo contexto reduce latencia y uso de memoria
 * - Simplifica la sincronización entre módulos
 *
 * ¿Por qué requiere resume() manual?
 * - Los navegadores modernos (autoplay policy) bloquean el audio hasta
 *   que hay una interacción del usuario (click, tecla, touch)
 */

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface AudioContextConfig {
  /** Sample rate deseado (default: 48000) */
  sampleRate?: number;
  /** Hint de latencia (default: 'interactive') */
  latencyHint?: AudioContextLatencyCategory | number;
  /** Habilitar logs (default: true en dev, false en prod) */
  verbose?: boolean;
}

export interface AudioContextStats {
  state: AudioContextState;
  sampleRate: number;
  currentTime: number;
  baseLatency: number;
  outputLatency: number;
  hasContext: boolean;
  hasMaster: boolean;
}

export type ContextManagerEvent =
  | { type: 'initialized'; sampleRate: number }
  | { type: 'resumed' }
  | { type: 'suspended' }
  | { type: 'closed' }
  | { type: 'stateChanged'; state: AudioContextState }
  | { type: 'error'; error: Error };

export type ContextManagerListener = (event: ContextManagerEvent) => void;

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CONFIG: Required<AudioContextConfig> = {
  sampleRate: 48000,
  latencyHint: 'interactive',
  verbose: import.meta.env?.DEV ?? false,
};

// ═══════════════════════════════════════════════════════════════
// 🎯 CLASE
// ═══════════════════════════════════════════════════════════════

export class AudioContextManager {
  private static _instance: AudioContextManager | null = null;

  private _context: AudioContext | null = null;
  private _masterGain: GainNode | null = null;
  private _config: Required<AudioContextConfig> = DEFAULT_CONFIG;

  private _listeners = new Set<ContextManagerListener>();
  private _stateChangeHandler: (() => void) | null = null;

  private constructor() {}

  // ─────────────────────────────────────────────
  // Singleton
  // ─────────────────────────────────────────────

  public static getInstance(): AudioContextManager {
    if (!AudioContextManager._instance) {
      AudioContextManager._instance = new AudioContextManager();
    }
    return AudioContextManager._instance;
  }

  /** ¿El navegador soporta Web Audio API? */
  public static isSupported(): boolean {
    return typeof AudioContext !== 'undefined' ||
           typeof (window as unknown as { webkitAudioContext?: unknown }).webkitAudioContext !== 'undefined';
  }

  // ─────────────────────────────────────────────
  // Inicialización
  // ─────────────────────────────────────────────

  /**
   * Inicializa el AudioContext y el nodo master de salida.
   * Es idempotente: si ya está inicializado, devuelve el contexto existente.
   *
   * @throws Error si Web Audio no está soportado o si falla la creación
   */
  public init(configOrSampleRate: AudioContextConfig | number = {}): AudioContext {
    // Ya existe → devolver
    if (this._context) {
      const desiredSR =
        typeof configOrSampleRate === 'number'
          ? configOrSampleRate
          : configOrSampleRate.sampleRate;

      if (desiredSR && desiredSR !== this._context.sampleRate) {
        this._log(
          `Sample rate solicitado (${desiredSR}Hz) diferente al actual (${this._context.sampleRate}Hz). ` +
          `Usa close() + init() para cambiarlo.`,
          'warn'
        );
      }
      return this._context;
    }

    // Verificar soporte
    if (!AudioContextManager.isSupported()) {
      const err = new Error('Web Audio API no soportado en este navegador');
      this._emit({ type: 'error', error: err });
      throw err;
    }

    // Normalizar config
    if (typeof configOrSampleRate === 'number') {
      this._config = { ...DEFAULT_CONFIG, sampleRate: configOrSampleRate };
    } else {
      this._config = { ...DEFAULT_CONFIG, ...configOrSampleRate };
    }

    try {
      // Crear contexto
      this._context = new AudioContext({
        latencyHint: this._config.latencyHint,
        sampleRate: this._config.sampleRate,
      });

      // Master gain
      this._masterGain = this._context.createGain();
      this._masterGain.gain.value = 1;
      this._masterGain.connect(this._context.destination);

      // Listener de cambios de estado
      this._attachStateListener();

      this._emit({
        type: 'initialized',
        sampleRate: this._context.sampleRate,
      });

      this._log(
        `Inicializado @ ${this._context.sampleRate}Hz | ` +
        `baseLatency=${(this._context.baseLatency * 1000).toFixed(1)}ms`
      );

      return this._context;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._log(`Error al crear AudioContext: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // Control de estado
  // ─────────────────────────────────────────────

  /**
   * Desbloquea el audio tras una interacción del usuario.
   * Los navegadores modernos requieren esto por la autoplay policy.
   */
  public async resume(): Promise<void> {
    if (!this._context) {
      this._log('resume() llamado sin contexto', 'warn');
      return;
    }

    if (this._context.state === 'running') return;

    if (this._context.state === 'closed') {
      throw new Error('No se puede resumir un contexto cerrado');
    }

    try {
      await this._context.resume();
      this._emit({ type: 'resumed' });
      this._log('Contexto resumido');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._emit({ type: 'error', error });
      throw error;
    }
  }

  /** Suspende el audio (útil al pausar o para ahorrar recursos). */
  public async suspend(): Promise<void> {
    if (!this._context || this._context.state !== 'running') return;

    try {
      await this._context.suspend();
      this._emit({ type: 'suspended' });
      this._log('Contexto suspendido');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._emit({ type: 'error', error });
      throw error;
    }
  }

  /**
   * Cierra completamente el contexto y libera recursos.
   * Después de close() hay que llamar a init() de nuevo.
   */
  public async close(): Promise<void> {
    if (!this._context) return;

    try {
      this._detachStateListener();

      if (this._masterGain) {
        this._masterGain.disconnect();
        this._masterGain = null;
      }

      if (this._context.state !== 'closed') {
        await this._context.close();
      }

      this._context = null;
      this._emit({ type: 'closed' });
      this._log('Contexto cerrado');
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._emit({ type: 'error', error });
      throw error;
    }
  }

  // ─────────────────────────────────────────────
  // Utilidades
  // ─────────────────────────────────────────────

  /**
   * Espera a que el contexto esté en estado 'running'.
   * Útil para operaciones que requieren audio activo.
   *
   * @param timeoutMs Timeout máximo en ms (default: 5000)
   * @throws Error si se alcanza el timeout
   */
  public async waitForRunning(timeoutMs = 5000): Promise<void> {
    if (!this._context) {
      throw new Error('Contexto no inicializado');
    }

    if (this._context.state === 'running') return;

    return new Promise<void>((resolve, reject) => {
      const ctx = this._context!;
      const timeout = window.setTimeout(() => {
        ctx.removeEventListener('statechange', check);
        reject(new Error(`Timeout esperando estado 'running' (${timeoutMs}ms)`));
      }, timeoutMs);

      const check = () => {
        if (ctx.state === 'running') {
          window.clearTimeout(timeout);
          ctx.removeEventListener('statechange', check);
          resolve();
        }
      };

      ctx.addEventListener('statechange', check);
    });
  }

  // ─────────────────────────────────────────────
  // Sistema de eventos
  // ─────────────────────────────────────────────

  /** Registra un listener. Devuelve función para desregistrar. */
  public on(listener: ContextManagerListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _emit(event: ContextManagerEvent): void {
    this._listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[AudioContextManager] Error en listener:', err);
      }
    });
  }

  // ─────────────────────────────────────────────
  // Estado y métricas
  // ─────────────────────────────────────────────

  /** Snapshot de métricas para debugging */
  public getStats(): AudioContextStats {
    if (!this._context) {
      return {
        state: 'closed',
        sampleRate: 0,
        currentTime: 0,
        baseLatency: 0,
        outputLatency: 0,
        hasContext: false,
        hasMaster: false,
      };
    }

    return {
      state: this._context.state,
      sampleRate: this._context.sampleRate,
      currentTime: this._context.currentTime,
      baseLatency: this._context.baseLatency,
      outputLatency: this._context.outputLatency ?? 0,
      hasContext: true,
      hasMaster: this._masterGain !== null,
    };
  }

  public get isInitialized(): boolean {
    return this._context !== null;
  }

  public get isRunning(): boolean {
    return this._context?.state === 'running';
  }

  public get contextState(): AudioContextState | 'uninitialized' {
    return this._context?.state ?? 'uninitialized';
  }

  // ─────────────────────────────────────────────
  // Getters (compatibilidad con API anterior)
  // ─────────────────────────────────────────────

  public get context(): AudioContext {
    if (!this._context) {
      throw new Error('AudioContext no inicializado. Llama a init() primero.');
    }
    return this._context;
  }

  public get master(): GainNode {
    if (!this._masterGain) {
      throw new Error('MasterGain no inicializado. Llama a init() primero.');
    }
    return this._masterGain;
  }

  public get sampleRate(): number {
    return this.context.sampleRate;
  }

  /** Tiempo actual del reloj de audio (segundos, alta precisión). */
  public get currentTime(): number {
    return this.context.currentTime;
  }

  /** Latencia base del hardware en segundos */
  public get baseLatency(): number {
    return this._context?.baseLatency ?? 0;
  }

  /** Latencia total incluyendo buffer en segundos */
  public get outputLatency(): number {
    return this._context?.outputLatency ?? 0;
  }

  // ─────────────────────────────────────────────
  // Internos
  // ─────────────────────────────────────────────

  private _attachStateListener(): void {
    if (!this._context) return;

    this._stateChangeHandler = () => {
      const state = this._context?.state;
      if (!state) return;

      this._emit({ type: 'stateChanged', state });
      this._log(`Estado → ${state}`);
    };

    this._context.addEventListener('statechange', this._stateChangeHandler);
  }

  private _detachStateListener(): void {
    if (this._context && this._stateChangeHandler) {
      this._context.removeEventListener('statechange', this._stateChangeHandler);
      this._stateChangeHandler = null;
    }
  }

  private _log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this._config.verbose && level === 'info') return;

    const prefix = '[AudioContextManager]';
    switch (level) {
      case 'error': console.error(prefix, msg); break;
      case 'warn':  console.warn(prefix, msg);  break;
      default:      console.info(prefix, msg);
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════

export const audioContextManager = AudioContextManager.getInstance();