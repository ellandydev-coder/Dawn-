/**
 * audio.types.ts
 * --------------
 * Tipos fundamentales del dominio de audio.
 * Usa BRANDED TYPES para prevenir mezclar valores incompatibles
 * (ej: pasar segundos donde se esperan beats).
 *
 * FILOSOFÍA:
 *  - Solo tipos que YA se usan en el código actual
 *  - Branded types para valores con unidades
 *  - Type aliases para IDs de dominio
 *  - Enums cerrados para valores discretos
 */

// ═══════════════════════════════════════════════════════════════
// 🎯 BRANDED TYPES (unidades de medida)
// ═══════════════════════════════════════════════════════════════

/**
 * Truco de TypeScript para crear "sub-tipos" de primitives.
 * Previene errores como: `setTime(getBeats())` cuando esperabas seconds.
 */
type Brand<T, B> = T & { readonly __brand: B };

/** Segundos (tiempo absoluto de audio) */
export type Seconds = Brand<number, 'Seconds'>;

/** Beats (posición musical) */
export type Beats = Brand<number, 'Beats'>;

/** Bars (compases) */
export type Bars = Brand<number, 'Bars'>;

/** Samples (unidad de muestra individual) */
export type Samples = Brand<number, 'Samples'>;

/** Beats por minuto */
export type BPM = Brand<number, 'BPM'>;

/** Hertz (frecuencia) */
export type Hz = Brand<number, 'Hz'>;

/** Decibelios (volumen logarítmico, típicamente -60 a +6) */
export type Decibels = Brand<number, 'Decibels'>;

/** Valor lineal normalizado (0.0 a 1.0) */
export type NormalizedValue = Brand<number, 'NormalizedValue'>;

/** Paneo (-1 = full L, 0 = center, 1 = full R) */
export type PanValue = Brand<number, 'PanValue'>;

/** Número de nota MIDI (0-127) */
export type MidiNote = Brand<number, 'MidiNote'>;

/** Velocidad MIDI (0-127) */
export type MidiVelocity = Brand<number, 'MidiVelocity'>;

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTRUCTORES SEGUROS (con validación)
// ═══════════════════════════════════════════════════════════════

/** Crea un valor Seconds con validación */
export const seconds = (n: number): Seconds => {
  if (n < 0) throw new Error(`Seconds no puede ser negativo: ${n}`);
  return n as Seconds;
};

/** Crea un valor BPM con validación (típicamente 20-999) */
export const bpm = (n: number): BPM => {
  if (n < 1 || n > 999) throw new Error(`BPM fuera de rango [1, 999]: ${n}`);
  return n as BPM;
};

/** Crea un valor normalizado (0-1) con clamp automático */
export const normalized = (n: number): NormalizedValue => {
  return Math.max(0, Math.min(1, n)) as NormalizedValue;
};

/** Crea un valor de paneo (-1 a 1) con clamp automático */
export const pan = (n: number): PanValue => {
  return Math.max(-1, Math.min(1, n)) as PanValue;
};

/** Crea un valor MIDI (0-127) con clamp automático */
export const midiNote = (n: number): MidiNote => {
  return Math.max(0, Math.min(127, Math.round(n))) as MidiNote;
};

// ═══════════════════════════════════════════════════════════════
// 🎯 IDS DE DOMINIO (branded strings)
// ═══════════════════════════════════════════════════════════════

/** Identificador único de una pista */
export type TrackId = Brand<string, 'TrackId'>;

/** Identificador único de un clip */
export type ClipId = Brand<string, 'ClipId'>;

/** Identificador único de un asset (sample cargado) */
export type AssetId = Brand<string, 'AssetId'>;

/** Identificador único de un efecto */
export type EffectId = Brand<string, 'EffectId'>;

/** Identificador único de un bus */
export type BusId = Brand<string, 'BusId'>;

/** Identificador único de un send */
export type SendId = Brand<string, 'SendId'>;

/** Identificador único de un marcador */
export type MarkerId = Brand<string, 'MarkerId'>;

/** Identificador único de una nota MIDI */
export type MidiNoteId = Brand<string, 'MidiNoteId'>;

/** Identificador union para cualquier entidad */
export type EntityId = TrackId | ClipId | AssetId | EffectId | BusId | SendId;

// ═══════════════════════════════════════════════════════════════
// 🎯 ENUMS DE AUDIO
// ═══════════════════════════════════════════════════════════════

/** Tipo de pista */
export type TrackType = 'audio' | 'midi' | 'bus' | 'aux' | 'master';

/** Tipo de clip */
export type ClipType = 'audio' | 'midi' | 'automation';

/** Estado del transporte */
export type TransportState = 'stopped' | 'playing' | 'paused' | 'recording';

/** Modo de automatización */
export type AutomationMode = 'read' | 'write' | 'touch' | 'latch' | 'off';

/** Ley de paneo */
export type PanLaw = 'linear' | '-3dB' | '-4.5dB' | '-6dB';

/** Curva de fade */
export type FadeCurve = 'linear' | 'exponential' | 'logarithmic' | 'sCurve';

// ═══════════════════════════════════════════════════════════════
// 🎯 ESTRUCTURAS DE DATOS COMUNES
// ═══════════════════════════════════════════════════════════════

/** Rango temporal (usado en regions, loops, selecciones) */
export interface TimeRange {
  readonly start: Seconds;
  readonly end: Seconds;
}

/** Rango musical (usado en clips MIDI) */
export interface BeatRange {
  readonly startBeat: Beats;
  readonly endBeat: Beats;
}

/** Signatura de tiempo (4/4, 3/4, etc.) */
export interface TimeSignature {
  readonly numerator: number;   // 4 (en 4/4)
  readonly denominator: number; // 4 (en 4/4)
}

/** Posición combinada (bar:beat:tick) */
export interface MusicalPosition {
  readonly bar: number;
  readonly beat: number;
  readonly tick: number;
}

/** Punto de automatización */
export interface AutomationPoint {
  readonly time: Seconds;
  readonly value: NormalizedValue;
  readonly curve?: FadeCurve;
}