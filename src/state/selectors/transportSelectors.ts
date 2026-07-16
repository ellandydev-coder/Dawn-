/**
 * transportSelectors.ts
 * ---------------------
 * Selectores memoizados para el estado de transporte.
 *
 * Convenciones:
 * - BPM y timeSignature se leen desde projectSelectors (fuente de verdad)
 * - Selectores base: O(1), sin memoización
 * - Selectores derivados: createSelector, memoizados
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@state/store';
import {
  selectProjectBpm,
  selectProjectTimeSignature,
} from '@state/selectors/projectSelectors';

// ═══════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════

export type TransportStatus = 'stopped' | 'playing' | 'recording';

export interface LoopRange {
  start: number;
  end: number;
}

// ═══════════════════════════════════════════
// Selectores base (O(1), sin memoización)
// ═══════════════════════════════════════════

export const selectTransport = (state: RootState) => state.transport;

export const selectIsPlaying = (state: RootState): boolean =>
  state.transport.isPlaying;

export const selectIsRecording = (state: RootState): boolean =>
  state.transport.isRecording;

export const selectPlayheadSeconds = (state: RootState): number =>
  state.transport.playheadSeconds;

export const selectEditCursorSeconds = (state: RootState): number =>
  state.transport.editCursorSeconds;

export const selectLoopEnabled = (state: RootState): boolean =>
  state.transport.loopEnabled;

export const selectLoopStart = (state: RootState): number =>
  state.transport.loopStart;

export const selectLoopEnd = (state: RootState): number =>
  state.transport.loopEnd;

export const selectMetronomeEnabled = (state: RootState): boolean =>
  state.transport.metronomeEnabled;

/**
 * Fuente de verdad para BPM y compás: projectSlice.
 * Re-exportados para que consumidores del transport no necesiten
 * importar projectSelectors directamente.
 */
export const selectBpm = selectProjectBpm;
export const selectTimeSignature = selectProjectTimeSignature;

// ═══════════════════════════════════════════
// Estado de transporte
// ═══════════════════════════════════════════

/** true si el transport está detenido (ni playing ni recording) */
export const selectIsStopped = createSelector(
  [selectIsPlaying, selectIsRecording],
  (isPlaying, isRecording): boolean => !isPlaying && !isRecording
);

/** true si el transport está en movimiento (playing o recording) */
export const selectIsRunning = createSelector(
  [selectIsPlaying, selectIsRecording],
  (isPlaying, isRecording): boolean => isPlaying || isRecording
);

/** Estado discreto del transport como string literal */
export const selectTransportStatus = createSelector(
  [selectIsPlaying, selectIsRecording],
  (isPlaying, isRecording): TransportStatus => {
    if (isRecording) return 'recording';
    if (isPlaying) return 'playing';
    return 'stopped';
  }
);

// ═══════════════════════════════════════════
// Cursor / Playhead
// ═══════════════════════════════════════════

/**
 * Cursor activo según el estado del transport:
 * - Playing → playheadSeconds (posición en tiempo real)
 * - Stopped → editCursorSeconds (posición del cursor de edición)
 */
export const selectActiveCursorSeconds = createSelector(
  [selectIsPlaying, selectPlayheadSeconds, selectEditCursorSeconds],
  (isPlaying, playhead, editCursor): number =>
    isPlaying ? playhead : editCursor
);

// ═══════════════════════════════════════════
// Loop
// ═══════════════════════════════════════════

/** Rango del loop como objeto { start, end } */
export const selectLoopRange = createSelector(
  [selectLoopStart, selectLoopEnd],
  (start, end): LoopRange => ({ start, end })
);

/** Duración del loop en segundos (0 si inválido) */
export const selectLoopDuration = createSelector(
  [selectLoopStart, selectLoopEnd],
  (start, end): number => Math.max(0, end - start)
);

/** true si el rango de loop es válido (end > start) */
export const selectHasValidLoopRange = createSelector(
  [selectLoopStart, selectLoopEnd],
  (start, end): boolean => end > start
);

/** true si el loop está habilitado Y tiene un rango válido */
export const selectIsLoopActive = createSelector(
  [selectLoopEnabled, selectLoopStart, selectLoopEnd],
  (enabled, start, end): boolean => enabled && end > start
);

// ═══════════════════════════════════════════
// Time signature / BPM helpers
// ═══════════════════════════════════════════

/** Label legible del compás (ej: "4/4", "3/4", "6/8") */
export const selectTimeSignatureLabel = createSelector(
  [selectTimeSignature],
  (ts): string => `${ts.numerator}/${ts.denominator}`
);

/**
 * Duración de un compás en segundos.
 * Fórmula: (numerator * 60) / (bpm * (denominator / 4))
 * Ej: 4/4 a 120 BPM = 2 segundos por compás
 */
export const selectBarDurationSeconds = createSelector(
  [selectBpm, selectTimeSignature],
  (bpm, ts): number => {
    if (bpm <= 0) return 0;
    return (ts.numerator * 60) / (bpm * (ts.denominator / 4));
  }
);

/**
 * Duración de un beat en segundos.
 * Ej: 120 BPM = 0.5 segundos por beat
 */
export const selectBeatDurationSeconds = createSelector(
  [selectBpm],
  (bpm): number => (bpm > 0 ? 60 / bpm : 0)
);

/**
 * Playhead expresado en beats (basado en BPM actual).
 * Útil para snapping, grid rendering, piano roll.
 */
export const selectPlayheadBeats = createSelector(
  [selectPlayheadSeconds, selectBpm],
  (seconds, bpm): number => (bpm > 0 ? (seconds * bpm) / 60 : 0)
);

/**
 * Playhead expresado en compases (bar:beat format).
 * Retorna { bar, beat } basados en 1 (no 0-indexed).
 */
export const selectPlayheadBarBeat = createSelector(
  [selectPlayheadBeats, selectTimeSignature],
  (totalBeats, ts): { bar: number; beat: number } => {
    const beatsPerBar = ts.numerator;
    if (beatsPerBar <= 0) return { bar: 1, beat: 1 };

    const bar = Math.floor(totalBeats / beatsPerBar) + 1;
    const beat = Math.floor(totalBeats % beatsPerBar) + 1;

    return { bar, beat };
  }
);