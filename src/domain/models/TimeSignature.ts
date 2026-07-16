import { z } from 'zod';

/**
 * TimeSignature
 * -------------
 * Signatura de tiempo (compás musical).
 */

export const TimeSignatureSchema = z.object({
  numerator:   z.number().int().min(1).max(32),
  denominator: z.number().int().refine(
    (v) => [1, 2, 4, 8, 16, 32].includes(v),
    { message: 'Denominator must be a power of 2 (1, 2, 4, 8, 16, 32)' }
  ),
});

export type TimeSignature = z.infer<typeof TimeSignatureSchema>;

export const DEFAULT_TIME_SIGNATURE: TimeSignature = {
  numerator:   4,
  denominator: 4,
};

/** Signaturas comunes para UI */
export const COMMON_TIME_SIGNATURES: readonly TimeSignature[] = [
  { numerator: 4,  denominator: 4 },
  { numerator: 3,  denominator: 4 },
  { numerator: 6,  denominator: 8 },
  { numerator: 5,  denominator: 4 },
  { numerator: 7,  denominator: 8 },
  { numerator: 12, denominator: 8 },
];

/** Formatea como "4/4" */
export const formatTimeSignature = (ts: TimeSignature): string =>
  `${ts.numerator}/${ts.denominator}`;

/** Beats por compás */
export const beatsPerBar = (ts: TimeSignature): number =>
  ts.numerator;

/** Segundos por beat dado un BPM */
export const secondsPerBeat = (bpm: number): number =>
  60 / bpm;

/** Segundos por compás dado un BPM y signatura */
export const secondsPerBar = (ts: TimeSignature, bpm: number): number =>
  beatsPerBar(ts) * secondsPerBeat(bpm);