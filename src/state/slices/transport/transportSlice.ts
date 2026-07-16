// src/state/slices/transport/transportSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const MIN_POSITION = 0;
const MIN_LOOP_DURATION = 0.1;
const DEFAULT_LOOP_START = 0;
const DEFAULT_LOOP_END = 8;

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface TransportState {
  isPlaying: boolean;
  isRecording: boolean;

  /** True mientras el metrónomo hace el pre-roll antes de grabar */
  isCountingIn: boolean;

  /** Play cursor: posición actual de reproducción (seconds) */
  playheadSeconds: number;

  /** Edit cursor: punto de retorno / desde dónde reproducir (seconds) */
  editCursorSeconds: number;

  /** Loop */
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;

  /** Metrónomo */
  metronomeEnabled: boolean;

  /** Pre-roll / count-in (compases antes de grabar) */
  countInEnabled: boolean;
  countInBars: number;
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

function clampPosition(value: number): number {
  return Math.max(MIN_POSITION, value);
}

function normalizeLoopRange(
  start: number,
  end: number
): { start: number; end: number } {
  const clampedStart = Math.max(MIN_POSITION, start);
  const clampedEnd = Math.max(MIN_POSITION, end);

  if (clampedStart >= clampedEnd) {
    return {
      start: clampedEnd,
      end: clampedEnd + MIN_LOOP_DURATION,
    };
  }

  if (clampedEnd - clampedStart < MIN_LOOP_DURATION) {
    return {
      start: clampedStart,
      end: clampedStart + MIN_LOOP_DURATION,
    };
  }

  return { start: clampedStart, end: clampedEnd };
}

const createInitialState = (): TransportState => ({
  isPlaying: false,
  isRecording: false,
  isCountingIn: false,
  playheadSeconds: 0,
  editCursorSeconds: 0,
  loopEnabled: false,
  loopStart: DEFAULT_LOOP_START,
  loopEnd: DEFAULT_LOOP_END,
  metronomeEnabled: false,
  countInEnabled: false,
  countInBars: 1,
});

// ═══════════════════════════════════════════════════════════════
// 🏪 SLICE
// ═══════════════════════════════════════════════════════════════

const initialState: TransportState = createInitialState();

const transportSlice = createSlice({
  name: 'transport',
  initialState,
  reducers: {
    // ─── PLAYBACK ───────────────────────────────────────────

    play(state) {
      if (state.isPlaying) return;

      state.playheadSeconds = state.editCursorSeconds;
      state.isPlaying = true;
      state.isCountingIn = false;
    },

    pause(state) {
      if (!state.isPlaying) return;
      state.isPlaying = false;
      state.playheadSeconds = state.editCursorSeconds;
    },

    stop(state) {
      state.isPlaying = false;
      state.isRecording = false;
      state.isCountingIn = false;
      state.playheadSeconds = state.editCursorSeconds;
    },

    stopAndRewind(state) {
      state.isPlaying = false;
      state.isRecording = false;
      state.isCountingIn = false;
      state.playheadSeconds = 0;
      state.editCursorSeconds = 0;
    },

    togglePlayPause(state) {
      if (state.isPlaying) {
        state.isPlaying = false;
        state.playheadSeconds = state.editCursorSeconds;
      } else {
        state.playheadSeconds = state.editCursorSeconds;
        state.isPlaying = true;
        state.isCountingIn = false;
      }
    },

    // ─── RECORDING ──────────────────────────────────────────
    //
    // Nota: el auto-play ya NO ocurre en el reducer.
    // El recordingHandler decide si arranca inmediato o con count-in.

    /**
     * Alterna el estado de grabación.
     *
     * ⚠️ Contrato asíncrono:
     * Este reducer SOLO cambia `isRecording`. El `isPlaying` se activa
     * en el siguiente tick vía `recordingHandlers` (listener middleware),
     * que decide si arrancar inmediato o con count-in según config.
     *
     * Para observar el estado final, suscríbete al store en lugar de
     * asumir que `isPlaying` cambia en el mismo dispatch.
     */
    toggleRecord(state) {
      if (state.isRecording) {
        state.isRecording = false;
        state.isCountingIn = false;
      } else {
        state.isRecording = true;
      }
    },

    /**
     * Fuerza un valor de `isRecording`.
     *
     * ⚠️ Contrato asíncrono:
     * Igual que `toggleRecord`, el `isPlaying` se activa vía middleware
     * cuando `payload === true`. Ver JSDoc de `toggleRecord`.
     */
    setRecording(state, action: PayloadAction<boolean>) {
      state.isRecording = action.payload;
      if (!action.payload) {
        state.isCountingIn = false;
      }
    },

    // ─── COUNT-IN ───────────────────────────────────────────

    /** Entra en fase de pre-roll. Playhead no se mueve todavía. */
    startCountIn(state) {
      state.isCountingIn = true;
      state.isPlaying = false; // asegurarse
      state.playheadSeconds = state.editCursorSeconds;
    },

    /** Count-in terminado → arranca playback+grabación. */
    finishCountIn(state) {
      state.isCountingIn = false;
      state.playheadSeconds = state.editCursorSeconds;
      state.isPlaying = true;
    },

    /** Usuario canceló el count-in antes de que terminase. */
    cancelCountIn(state) {
      state.isCountingIn = false;
      state.isRecording = false;
      state.isPlaying = false;
      state.playheadSeconds = state.editCursorSeconds;
    },

    // ─── CURSORES ───────────────────────────────────────────

    setPlayhead(state, action: PayloadAction<number>) {
      state.playheadSeconds = clampPosition(action.payload);
    },

    setEditCursor(state, action: PayloadAction<number>) {
      const pos = clampPosition(action.payload);
      state.editCursorSeconds = pos;

      if (!state.isPlaying) {
        state.playheadSeconds = pos;
      }
    },

    seekTo(state, action: PayloadAction<number>) {
      const pos = clampPosition(action.payload);
      state.playheadSeconds = pos;
      state.editCursorSeconds = pos;
    },

    nudgeEditCursor(state, action: PayloadAction<number>) {
      const newPos = clampPosition(
        state.editCursorSeconds + action.payload
      );
      state.editCursorSeconds = newPos;

      if (!state.isPlaying) {
        state.playheadSeconds = newPos;
      }
    },

    // ─── LOOP ───────────────────────────────────────────────

    toggleLoop(state) {
      state.loopEnabled = !state.loopEnabled;
    },

    setLoopEnabled(state, action: PayloadAction<boolean>) {
      state.loopEnabled = action.payload;
    },

    setLoopRange(
      state,
      action: PayloadAction<{ start: number; end: number }>
    ) {
      const normalized = normalizeLoopRange(
        action.payload.start,
        action.payload.end
      );
      state.loopStart = normalized.start;
      state.loopEnd = normalized.end;
    },

    setLoopStart(state, action: PayloadAction<number>) {
      const normalized = normalizeLoopRange(
        action.payload,
        state.loopEnd
      );
      state.loopStart = normalized.start;
      state.loopEnd = normalized.end;
    },

    setLoopEnd(state, action: PayloadAction<number>) {
      const normalized = normalizeLoopRange(
        state.loopStart,
        action.payload
      );
      state.loopStart = normalized.start;
      state.loopEnd = normalized.end;
    },

    setLoopFromSelection(
      state,
      action: PayloadAction<{ start: number; end: number }>
    ) {
      const normalized = normalizeLoopRange(
        action.payload.start,
        action.payload.end
      );
      state.loopStart = normalized.start;
      state.loopEnd = normalized.end;
      state.loopEnabled = true;
    },

    // ─── METRÓNOMO ──────────────────────────────────────────

    toggleMetronome(state) {
      state.metronomeEnabled = !state.metronomeEnabled;
    },

    setMetronomeEnabled(state, action: PayloadAction<boolean>) {
      state.metronomeEnabled = action.payload;
    },

    // ─── COUNT-IN CONFIG ────────────────────────────────────

    toggleCountIn(state) {
      state.countInEnabled = !state.countInEnabled;
    },

    setCountInEnabled(state, action: PayloadAction<boolean>) {
      state.countInEnabled = action.payload;
    },

    setCountInBars(state, action: PayloadAction<number>) {
      state.countInBars = Math.max(1, Math.min(4, action.payload));
    },

    // ─── BULK / PROYECTO ────────────────────────────────────

    loadTransportConfig(
      state,
      action: PayloadAction<{
        loopEnabled?: boolean;
        loopStart?: number;
        loopEnd?: number;
        metronomeEnabled?: boolean;
        countInEnabled?: boolean;
        countInBars?: number;
        editCursorSeconds?: number;
      }>
    ) {
      const config = action.payload;

      if (config.loopEnabled !== undefined) {
        state.loopEnabled = config.loopEnabled;
      }

      if (
        config.loopStart !== undefined ||
        config.loopEnd !== undefined
      ) {
        const normalized = normalizeLoopRange(
          config.loopStart ?? state.loopStart,
          config.loopEnd ?? state.loopEnd
        );
        state.loopStart = normalized.start;
        state.loopEnd = normalized.end;
      }

      if (config.metronomeEnabled !== undefined) {
        state.metronomeEnabled = config.metronomeEnabled;
      }

      if (config.countInEnabled !== undefined) {
        state.countInEnabled = config.countInEnabled;
      }

      if (config.countInBars !== undefined) {
        state.countInBars = Math.max(1, Math.min(4, config.countInBars));
      }

      if (config.editCursorSeconds !== undefined) {
        const pos = clampPosition(config.editCursorSeconds);
        state.editCursorSeconds = pos;
        state.playheadSeconds = pos;
      }
    },

    resetTransport() {
      return createInitialState();
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: ACCIONES
// ═══════════════════════════════════════════════════════════════

export const {
  // Playback
  play,
  pause,
  stop,
  stopAndRewind,
  togglePlayPause,
  // Recording
  toggleRecord,
  setRecording,
  // Count-in transiciones
  startCountIn,
  finishCountIn,
  cancelCountIn,
  // Cursores
  setPlayhead,
  setEditCursor,
  seekTo,
  nudgeEditCursor,
  // Loop
  toggleLoop,
  setLoopEnabled,
  setLoopRange,
  setLoopStart,
  setLoopEnd,
  setLoopFromSelection,
  // Metrónomo
  toggleMetronome,
  setMetronomeEnabled,
  // Count-in config
  toggleCountIn,
  setCountInEnabled,
  setCountInBars,
  // Bulk
  loadTransportConfig,
  resetTransport,
} = transportSlice.actions;

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: SELECTORES BÁSICOS
// ═══════════════════════════════════════════════════════════════

export const selectTransportState = (state: { transport: TransportState }) =>
  state.transport;

export const selectIsPlaying = (state: { transport: TransportState }) =>
  state.transport.isPlaying;

export const selectIsRecording = (state: { transport: TransportState }) =>
  state.transport.isRecording;

export const selectIsCountingIn = (state: { transport: TransportState }) =>
  state.transport.isCountingIn;

export const selectPlayheadSeconds = (state: { transport: TransportState }) =>
  state.transport.playheadSeconds;

export const selectEditCursorSeconds = (state: { transport: TransportState }) =>
  state.transport.editCursorSeconds;

export default transportSlice.reducer;