/**
 * dBConversion
 * ------------
 * Utilidades para convertir entre valores lineales y decibelios (dB).
 *
 * Todo el mixer trabaja internamente en LINEAR (0..1+), pero muestra dB al usuario.
 *
 * Escala del fader:
 *   - Rango: -60 dB (silencio funcional) a +6 dB (headroom)
 *   - Total: 66 dB
 *   - Unity (0 dB): posición ~9.09% desde arriba
 *
 * ⚠️ Todas las funciones son:
 *   - Puras (sin side effects)
 *   - Determinísticas
 *   - Defensivas (validan inputs)
 *   - Type-safe
 */

// ═══════════════════════════════════════════
// Constantes de la escala
// ═══════════════════════════════════════════

/** Mínimo dB representable en el fader (por debajo = silencio) */
export const DB_MIN = -60;

/** Máximo dB del fader (headroom sobre unity) */
export const DB_MAX = 6;

/** Rango total en dB del fader */
export const DB_RANGE = DB_MAX - DB_MIN; // 66

/** Valor lineal en unity gain (0 dB) */
export const UNITY_LINEAR = 1.0;

/** Volumen por defecto para nuevos tracks (unity gain / 0 dB) */
export const DEFAULT_VOLUME = 1.0;

/** Símbolo para representar silencio absoluto */
export const SILENCE_SYMBOL = '-∞';

/** Umbral amarillo típico para medidores */
export const DB_YELLOW_THRESHOLD = -12;

/** Umbral rojo típico para medidores */
export const DB_RED_THRESHOLD = -3;

/** Umbral de clipping (unity) */
export const DB_CLIP_THRESHOLD = 0;

/**
 * Marcas típicas del fader (en dB) para dibujar la escala.
 * Útil para renderizar ticks al lado del fader.
 */
export const FADER_DB_MARKS = [
  6, 3, 0, -3, -6, -12, -18, -24, -36, -48, -60,
] as const;

export type FaderDbMark = (typeof FADER_DB_MARKS)[number];

// ═══════════════════════════════════════════
// Helpers internos
// ═══════════════════════════════════════════

/** Clamp numérico genérico */
const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

/**
 * Verifica si un número es finito y no-NaN.
 * Rechaza Infinity, -Infinity y NaN deliberadamente:
 * -Infinity se maneja explícitamente en cada función.
 */
const isFiniteNumber = (n: unknown): n is number =>
  typeof n === 'number' && Number.isFinite(n);

// ═══════════════════════════════════════════
// Conversiones lineal ↔ dB
// ═══════════════════════════════════════════

/**
 * Convierte lineal (0..∞) → dB.
 * Retorna -Infinity para linear <= 0 o inputs inválidos.
 *
 * @example
 * linearToDb(1.0)  // 0
 * linearToDb(0.5)  // -6.02
 * linearToDb(0)    // -Infinity
 */
export function linearToDb(linear: number): number {
  if (!isFiniteNumber(linear) || linear <= 0) return -Infinity;
  return 20 * Math.log10(linear);
}

/**
 * Convierte dB → lineal (0..∞).
 * Retorna 0 para inputs inválidos o <= DB_MIN.
 *
 * @example
 * dbToLinear(0)         // 1.0
 * dbToLinear(-6)        // ~0.501
 * dbToLinear(-Infinity) // 0
 */
export function dbToLinear(db: number): number {
  if (typeof db !== 'number' || Number.isNaN(db)) return 0;
  if (!Number.isFinite(db) || db <= DB_MIN) return 0;
  return Math.pow(10, db / 20);
}

// ═══════════════════════════════════════════
// Formateo
// ═══════════════════════════════════════════

/**
 * Formatea un valor lineal como string dB legible para la UI.
 *
 * @example
 * formatDb(1.0)  // "0.0"
 * formatDb(1.5)  // "+3.5"
 * formatDb(0.5)  // "-6.0"
 * formatDb(0)    // "-∞"
 */
export function formatDb(linear: number, decimals = 1): string {
  const db = linearToDb(linear);
  if (!Number.isFinite(db)) return SILENCE_SYMBOL;
  if (db > 0) return `+${db.toFixed(decimals)}`;
  return db.toFixed(decimals); // incluye el "-" y el "0.0"
}

/**
 * Formatea un valor dB directo (sin conversión desde lineal).
 *
 * @example
 * formatDbValue(-12.5)      // "-12.5"
 * formatDbValue(3)          // "+3.0"
 * formatDbValue(-Infinity)  // "-∞"
 */
export function formatDbValue(db: number, decimals = 1): string {
  if (!Number.isFinite(db)) return SILENCE_SYMBOL;
  if (db > 0) return `+${db.toFixed(decimals)}`;
  return db.toFixed(decimals);
}

/**
 * Formatea un valor lineal como porcentaje legible.
 *
 * @example
 * formatPercent(0.5)   // "50%"
 * formatPercent(1.0)   // "100%"
 * formatPercent(1.5)   // "150%"
 */
export function formatPercent(linear: number, decimals = 0): string {
  if (!isFiniteNumber(linear)) return '0%';
  return `${(linear * 100).toFixed(decimals)}%`;
}

// ═══════════════════════════════════════════
// Conversiones para el FADER (curva logarítmica)
// ═══════════════════════════════════════════

/**
 * Convierte lineal (0..∞) → posición del fader en % (0–100).
 *
 * Escala visual:
 *   0%   = arriba (+6 dB)
 *   9.09% = unity (0 dB)
 *   100% = abajo (silencio)
 *
 * @example
 * linearToFaderPct(1.0)  // ~9.09 (unity)
 * linearToFaderPct(0.5)  // ~27.30 (-6 dB)
 * linearToFaderPct(0)    // 100   (silencio)
 */
export function linearToFaderPct(linear: number): number {
  if (!isFiniteNumber(linear) || linear <= 0) return 100;
  const db = clamp(linearToDb(linear), DB_MIN, DB_MAX);
  return ((DB_MAX - db) / DB_RANGE) * 100;
}

/**
 * Convierte posición del fader en % (0–100) → valor lineal.
 *
 * @example
 * faderPctToLinear(0)     // ~2.0  (+6 dB)
 * faderPctToLinear(9.09)  // ~1.0  (unity)
 * faderPctToLinear(100)   // 0     (silencio)
 */
export function faderPctToLinear(pct: number): number {
  if (!isFiniteNumber(pct)) return 0;
  const db = DB_MAX - (clamp(pct, 0, 100) / 100) * DB_RANGE;
  if (db <= DB_MIN) return 0;
  return dbToLinear(db);
}

/**
 * Convierte una marca dB a su posición en % del fader.
 * Idéntico a `linearToFaderPct` pero acepta dB directamente.
 *
 * @example
 * dbToFaderPct(0)   // ~9.09 (unity)
 * dbToFaderPct(-6)  // ~18.18
 * dbToFaderPct(-60) // 100
 */
export function dbToFaderPct(db: number): number {
  if (!isFiniteNumber(db)) return 100;
  return ((DB_MAX - clamp(db, DB_MIN, DB_MAX)) / DB_RANGE) * 100;
}

// ═══════════════════════════════════════════
// Conversiones auxiliares
// ═══════════════════════════════════════════

/**
 * Convierte lineal (0..1) → porcentaje simple (0–100).
 * Sin curva logarítmica. Para pan, wet/dry, envolventes, etc.
 *
 * @example
 * linearToPercent(0.5)  // 50
 */
export function linearToPercent(linear: number): number {
  if (!isFiniteNumber(linear)) return 0;
  return clamp(linear, 0, 1) * 100;
}

/**
 * Convierte porcentaje simple (0–100) → lineal (0..1).
 *
 * @example
 * percentToLinear(50)  // 0.5
 */
export function percentToLinear(pct: number): number {
  if (!isFiniteNumber(pct)) return 0;
  return clamp(pct, 0, 100) / 100;
}

/**
 * Convierte MIDI velocity (0–127) → lineal (0..1).
 *
 * @example
 * midiVelocityToLinear(127)  // 1.0
 * midiVelocityToLinear(64)   // ~0.504
 */
export function midiVelocityToLinear(velocity: number): number {
  if (!isFiniteNumber(velocity)) return 0;
  return clamp(velocity, 0, 127) / 127;
}

/**
 * Convierte lineal (0..1) → MIDI velocity (0–127).
 *
 * @example
 * linearToMidiVelocity(1.0)  // 127
 * linearToMidiVelocity(0.5)  // 64
 */
export function linearToMidiVelocity(linear: number): number {
  if (!isFiniteNumber(linear)) return 0;
  return Math.round(clamp(linear, 0, 1) * 127);
}

// ═══════════════════════════════════════════
// Utilidades de análisis
// ═══════════════════════════════════════════

/**
 * Detecta si un valor lineal está clippeando (> 0 dB, es decir > 1.0).
 *
 * @example
 * isClipping(1.5)  // true
 * isClipping(0.8)  // false
 */
export function isClipping(linear: number): boolean {
  return isFiniteNumber(linear) && linear > UNITY_LINEAR;
}

/**
 * Detecta si un valor lineal está por debajo del umbral de silencio.
 *
 * @example
 * isSilent(0)       // true
 * isSilent(0.0001)  // true  (≈ -80 dB)
 * isSilent(0.1)     // false (≈ -20 dB)
 */
export function isSilent(linear: number, thresholdDb = -80): boolean {
  if (!isFiniteNumber(linear) || linear <= 0) return true;
  return linearToDb(linear) <= thresholdDb;
}

/**
 * Normaliza un valor de peak de Float32Array para metering.
 * Toma el valor absoluto y lo clampea a un rango razonable.
 * Permite hasta +20 dB (~linear 10) para no saturar el meter.
 *
 * @example
 * safePeakToLinear(-1.2)  // 1.2  (valor absoluto)
 * safePeakToLinear(NaN)   // 0
 */
export function safePeakToLinear(peak: number): number {
  if (!isFiniteNumber(peak)) return 0;
  return clamp(Math.abs(peak), 0, 10);
}

// ═══════════════════════════════════════════
// Verificación de invariantes (DEV only)
// ═══════════════════════════════════════════

if (import.meta.env?.DEV) {
  const assert = (
    label: string,
    actual: number,
    expected: number,
    tolerance = 0.01
  ): void => {
    if (Math.abs(actual - expected) > tolerance) {
      console.warn(
        `[dBConversion] Invariante roto: ${label}\n` +
          `  Esperado: ${expected}\n` +
          `  Obtenido: ${actual}`
      );
    }
  };

  // Conversiones básicas
  assert('linearToDb(1) == 0', linearToDb(1), 0);
  assert('dbToLinear(0) == 1', dbToLinear(0), 1);
  assert('dbToLinear(-6) ≈ 0.501', dbToLinear(-6), 0.501);

  // Fader
  assert('linearToFaderPct(1) ≈ 9.09', linearToFaderPct(1), 9.09);
  assert('linearToFaderPct(0) == 100', linearToFaderPct(0), 100);
  assert('dbToFaderPct(0) ≈ 9.09', dbToFaderPct(0), 9.09);
  assert('dbToFaderPct(-60) == 100', dbToFaderPct(-60), 100);
  assert('dbToFaderPct(6) == 0', dbToFaderPct(6), 0);

  // Roundtrips
  assert(
    'roundtrip linear→faderPct→linear (0.5)',
    faderPctToLinear(linearToFaderPct(0.5)),
    0.5,
    0.001
  );
  assert(
    'roundtrip linear→faderPct→linear (1.0)',
    faderPctToLinear(linearToFaderPct(1.0)),
    1.0,
    0.001
  );

  // Consistencia con DEFAULT_VOLUME
  assert('DEFAULT_VOLUME == UNITY_LINEAR', DEFAULT_VOLUME, UNITY_LINEAR);

  // MIDI
  assert('midiVelocityToLinear(127) == 1', midiVelocityToLinear(127), 1);
  assert('linearToMidiVelocity(1) == 127', linearToMidiVelocity(1), 127);

  // Guards
  assert('dbToLinear(NaN) == 0', dbToLinear(NaN), 0);
  assert('linearToDb(NaN) == -Inf guard', linearToFaderPct(NaN), 100);
}