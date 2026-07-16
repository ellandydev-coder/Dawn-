/**
 * MetronomeEngine
 * ---------------
 * Metrónomo de alta precisión usando Web Audio API.
 *
 * Técnica: lookahead scheduling sobre AudioContext.currentTime.
 * Genera clicks reales con OscillatorNode + envelope de ganancia.
 *
 * Características:
 * - Beats acentuados (primer beat del compás)
 * - Subdivisiones (corcheas, semicorcheas, tresillos)
 * - Sonidos configurables (sine, click, woodblock, cowbell)
 * - Pre-count antes de grabar
 * - Volumen ajustable
 * - Sistema de eventos para UI
 *
 * Uso básico:
 * ```typescript
 *   const metro = new MetronomeEngine(ctx, masterGain);
 *   metro.setBpm(120);
 *   metro.setTimeSignature(4, 4);
 *   metro.setVolume(0.6);
 *   metro.start();
 * ```
 */

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export type MetronomeSound = 'sine' | 'click' | 'woodblock' | 'cowbell';

export type Subdivision = 1 | 2 | 3 | 4;
// 1 = quarter, 2 = eighth, 3 = triplet, 4 = sixteenth

export interface MetronomeConfig {
  /** BPM inicial (default: 120) */
  bpm?: number;
  /** Numerador del compás (default: 4) */
  numerator?: number;
  /** Denominador del compás (default: 4) */
  denominator?: number;
  /** Volumen 0-1 (default: 0.5) */
  volume?: number;
  /** Tipo de sonido (default: 'sine') */
  sound?: MetronomeSound;
  /** Subdivisión (default: 1 = solo negras) */
  subdivision?: Subdivision;
  /** Habilitar logs (default: true en dev) */
  verbose?: boolean;
}

export interface MetronomeStats {
  isRunning: boolean;
  isPaused: boolean;
  bpm: number;
  timeSignature: string;
  currentBeat: number;
  currentSubdivision: number;
  volume: number;
  sound: MetronomeSound;
  totalBeatsPlayed: number;
}

export type MetronomeEvent =
  | { type: 'started'; bpm: number }
  | { type: 'stopped' }
  | { type: 'paused' }
  | { type: 'resumed' }
  | { type: 'beat'; beat: number; isAccent: boolean; when: number }
  | { type: 'subdivision'; sub: number; when: number }
  | { type: 'preCountFinished' }
  | { type: 'bpmChanged'; bpm: number }
  | { type: 'timeSignatureChanged'; numerator: number; denominator: number };

export type MetronomeListener = (event: MetronomeEvent) => void;

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;

const SOUND_FREQUENCIES: Record<
  MetronomeSound,
  { accent: number; beat: number; sub: number }
> = {
  sine:      { accent: 1000, beat: 500,  sub: 350  },
  click:     { accent: 2000, beat: 1500, sub: 1000 },
  woodblock: { accent: 800,  beat: 600,  sub: 400  },
  cowbell:   { accent: 550,  beat: 420,  sub: 320  },
};

const SOUND_WAVEFORMS: Record<MetronomeSound, OscillatorType> = {
  sine:      'sine',
  click:     'square',
  woodblock: 'triangle',
  cowbell:   'sawtooth',
};

const CLICK_DURATION = 0.02;
const SUB_GAIN_RATIO = 0.5;

const DEFAULT_CONFIG: Required<MetronomeConfig> = {
  bpm: 120,
  numerator: 4,
  denominator: 4,
  volume: 0.5,
  sound: 'sine',
  subdivision: 1,
  verbose: import.meta.env?.DEV ?? false,
};

// ═══════════════════════════════════════════════════════════════
// 🎯 CLASE
// ═══════════════════════════════════════════════════════════════

export class MetronomeEngine {
  private _context: AudioContext;
  private _gainNode: GainNode;
  private _config: Required<MetronomeConfig>;

  private _isRunning = false;
  private _isPaused = false;
  private _timerId: number | null = null;

  private _bpm: number;
  private _numerator: number;
  private _denominator: number;
  private _volume: number;
  private _sound: MetronomeSound;
  private _subdivision: Subdivision;

  private _nextBeatTime = 0;
  private _currentBeat = 0;
  private _currentSubdivision = 0;
  private _totalBeatsPlayed = 0;

  // Pre-count
  private _preCountBeats = 0;
  private _preCountRemaining = 0;
  private _onPreCountFinished: (() => void) | null = null;

  private _listeners = new Set<MetronomeListener>();

  constructor(
    context: AudioContext,
    output: AudioNode,
    config: MetronomeConfig = {}
  ) {
    this._context = context;
    this._config = { ...DEFAULT_CONFIG, ...config };

    this._bpm = this._config.bpm;
    this._numerator = this._config.numerator;
    this._denominator = this._config.denominator;
    this._volume = this._config.volume;
    this._sound = this._config.sound;
    this._subdivision = this._config.subdivision;

    // Nodo de ganancia master del metrónomo
    this._gainNode = context.createGain();
    this._gainNode.gain.value = this._volume;
    this._gainNode.connect(output);

    this._log('Creado');
  }

  // ─────────────────────────────────────────────
  // Configuración
  // ─────────────────────────────────────────────

  public setBpm(bpm: number): void {
    const clamped = Math.max(20, Math.min(999, bpm));
    if (this._bpm === clamped) return;
    this._bpm = clamped;
    this._emit({ type: 'bpmChanged', bpm: clamped });
    this._log(`BPM → ${clamped}`);
  }

  public getBpm(): number {
    return this._bpm;
  }

  public setTimeSignature(numerator: number, denominator: number): void {
    const num = Math.max(1, Math.min(32, numerator));
    const den = [1, 2, 4, 8, 16, 32].includes(denominator) ? denominator : 4;

    if (this._numerator === num && this._denominator === den) return;

    this._numerator = num;
    this._denominator = den;
    this._currentBeat = 0;
    this._currentSubdivision = 0;

    this._emit({
      type: 'timeSignatureChanged',
      numerator: num,
      denominator: den,
    });
    this._log(`Time signature → ${num}/${den}`);
  }

  public setVolume(volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    this._volume = clamped;
    this._gainNode.gain.setTargetAtTime(
      clamped,
      this._context.currentTime,
      0.01
    );
  }

  public getVolume(): number {
    return this._volume;
  }

  public setSound(sound: MetronomeSound): void {
    this._sound = sound;
    this._log(`Sound → ${sound}`);
  }

  public getSound(): MetronomeSound {
    return this._sound;
  }

  public setSubdivision(sub: Subdivision): void {
    this._subdivision = sub;
    this._currentSubdivision = 0;
    this._log(`Subdivision → ${sub}`);
  }

  public getSubdivision(): Subdivision {
    return this._subdivision;
  }

  // ─────────────────────────────────────────────
  // Control principal
  // ─────────────────────────────────────────────

  public start(): void {
    if (this._isRunning) {
      this._log('start() ignorado: ya está corriendo', 'warn');
      return;
    }

    this._isRunning = true;
    this._isPaused = false;
    this._currentBeat = 0;
    this._currentSubdivision = 0;
    this._nextBeatTime = this._context.currentTime;
    this._scheduleTick();

    this._emit({ type: 'started', bpm: this._bpm });
    this._log(`Iniciado @ ${this._bpm} BPM`);
  }

  public stop(): void {
    if (!this._isRunning && !this._isPaused) return;

    this._isRunning = false;
    this._isPaused = false;
    this._preCountRemaining = 0;
    this._onPreCountFinished = null;

    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }

    this._emit({ type: 'stopped' });
    this._log('Detenido');
  }

  public pause(): void {
    if (!this._isRunning) return;

    this._isRunning = false;
    this._isPaused = true;

    if (this._timerId !== null) {
      clearTimeout(this._timerId);
      this._timerId = null;
    }

    this._emit({ type: 'paused' });
    this._log('Pausado');
  }

  public resume(): void {
    if (!this._isPaused) return;

    this._isRunning = true;
    this._isPaused = false;
    this._nextBeatTime = this._context.currentTime;
    this._scheduleTick();

    this._emit({ type: 'resumed' });
    this._log('Reanudado');
  }

  public startPreCount(beats: number, onFinished?: () => void): void {
    if (this._isRunning) {
      this._log('startPreCount() ignorado: ya está corriendo', 'warn');
      return;
    }

    this._preCountBeats = Math.max(1, Math.floor(beats));
    this._preCountRemaining = this._preCountBeats;
    this._onPreCountFinished = onFinished ?? null;

    this._log(`Pre-count de ${this._preCountBeats} beats`);
    this.start();
  }

  // ─────────────────────────────────────────────
  // Sistema de eventos
  // ─────────────────────────────────────────────

  public on(listener: MetronomeListener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _emit(event: MetronomeEvent): void {
    this._listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (err) {
        console.error('[MetronomeEngine] Error en listener:', err);
      }
    });
  }

  // ─────────────────────────────────────────────
  // Estado y métricas
  // ─────────────────────────────────────────────

  public getStats(): MetronomeStats {
    return {
      isRunning: this._isRunning,
      isPaused: this._isPaused,
      bpm: this._bpm,
      timeSignature: `${this._numerator}/${this._denominator}`,
      currentBeat: this._currentBeat,
      currentSubdivision: this._currentSubdivision,
      volume: this._volume,
      sound: this._sound,
      totalBeatsPlayed: this._totalBeatsPlayed,
    };
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  public get isPaused(): boolean {
    return this._isPaused;
  }

  public get currentBeat(): number {
    return this._currentBeat;
  }

  // ─────────────────────────────────────────────
  // Bucle de scheduling
  // ─────────────────────────────────────────────

  private _scheduleTick(): void {
    if (!this._isRunning) return;

    const scheduleUntil = this._context.currentTime + SCHEDULE_AHEAD_S;

    while (this._nextBeatTime < scheduleUntil) {
      const isBeatMain = this._currentSubdivision === 0;
      const isAccent = isBeatMain && this._currentBeat === 0;

      if (isBeatMain) {
        this._scheduleClick(this._nextBeatTime, isAccent ? 'accent' : 'beat');
        this._emit({
          type: 'beat',
          beat: this._currentBeat,
          isAccent,
          when: this._nextBeatTime,
        });
        this._totalBeatsPlayed += 1;

        if (this._preCountRemaining > 0) {
          this._preCountRemaining -= 1;
          if (this._preCountRemaining === 0) {
            const callback = this._onPreCountFinished;
            this._onPreCountFinished = null;
            this._emit({ type: 'preCountFinished' });
            this._log('Pre-count finalizado');
            if (callback) callback();
          }
        }
      } else {
        this._scheduleClick(this._nextBeatTime, 'sub');
        this._emit({
          type: 'subdivision',
          sub: this._currentSubdivision,
          when: this._nextBeatTime,
        });
      }

      this._advanceBeat();
    }

    this._timerId = window.setTimeout(
      () => this._scheduleTick(),
      LOOKAHEAD_MS
    );
  }

  private _advanceBeat(): void {
    const secondsPerBeat = 60 / this._bpm;
    const secondsPerSub = secondsPerBeat / this._subdivision;

    this._nextBeatTime += secondsPerSub;
    this._currentSubdivision += 1;

    if (this._currentSubdivision >= this._subdivision) {
      this._currentSubdivision = 0;
      this._currentBeat = (this._currentBeat + 1) % this._numerator;
    }
  }

  // ─────────────────────────────────────────────
  // Generación del click
  // ─────────────────────────────────────────────

  private _scheduleClick(
    when: number,
    type: 'accent' | 'beat' | 'sub'
  ): void {
    const freqs = SOUND_FREQUENCIES[this._sound];
    const waveform = SOUND_WAVEFORMS[this._sound];

    const freq =
      type === 'accent' ? freqs.accent :
      type === 'beat'   ? freqs.beat   :
                          freqs.sub;

    const gainMultiplier = type === 'sub' ? SUB_GAIN_RATIO : 1;

    try {
      const osc = this._context.createOscillator();
      osc.type = waveform;
      osc.frequency.value = freq;

      const env = this._context.createGain();
      env.gain.setValueAtTime(0, when);
      env.gain.linearRampToValueAtTime(gainMultiplier, when + 0.001);
      env.gain.exponentialRampToValueAtTime(0.001, when + CLICK_DURATION);

      osc.connect(env);
      env.connect(this._gainNode);

      osc.start(when);
      osc.stop(when + CLICK_DURATION + 0.01);

      osc.onended = () => {
        try {
          osc.disconnect();
          env.disconnect();
        } catch { /* ignore */ }
      };
    } catch (err) {
      this._log(`Error agendando click: ${err}`, 'error');
    }
  }

  // ─────────────────────────────────────────────
  // Cleanup
  // ─────────────────────────────────────────────

  public dispose(): void {
    this.stop();
    try {
      this._gainNode.disconnect();
    } catch { /* ignore */ }
    this._listeners.clear();
    this._log('Disposed');
  }

  // ─────────────────────────────────────────────
  // Logs
  // ─────────────────────────────────────────────

  private _log(
    msg: string,
    level: 'info' | 'warn' | 'error' = 'info'
  ): void {
    if (!this._config.verbose && level === 'info') return;

    const prefix = '[MetronomeEngine]';
    switch (level) {
      case 'error': console.error(prefix, msg); break;
      case 'warn':  console.warn(prefix, msg);  break;
      default:      console.info(prefix, msg);
    }
  }
}