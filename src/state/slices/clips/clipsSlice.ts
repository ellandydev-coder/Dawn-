// src/state/slices/clips/clipsSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { nanoid } from 'nanoid';
import type { Clip, ClipType } from '@domain/models/Clip';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const DEFAULT_CLIP_GAIN = 1;
const DEFAULT_CLIP_OFFSET = 0;
const DEFAULT_FADE_DURATION = 0;

const MIN_CLIP_GAIN = 0;
const MAX_CLIP_GAIN = 2;
const MIN_CLIP_DURATION = 0.001; // ~1ms mínimo (evita clips invisibles)
const MIN_CLIP_START_TIME = 0;
const MIN_FADE_DURATION = 0;

const FALLBACK_CLIP_NAME = 'Untitled Clip';
const DEFAULT_CLIP_COLOR = '#7A8CFF';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface ClipsState {
  byId: Record<string, Clip>;
  allIds: string[];
  selectedClipIds: string[];
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeClipName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : FALLBACK_CLIP_NAME;
}

function normalizeClipColor(color?: string): string {
  const trimmed = color?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_CLIP_COLOR;
}

function hasClip(state: ClipsState, id: string): boolean {
  return id in state.byId;
}

function createClip(payload: {
  trackId: string;
  type: ClipType;
  name: string;
  startTime: number;
  duration: number;
  offset?: number;
  color?: string;
  assetId?: string | null;
  gain?: number;
  fadeIn?: number;
  fadeOut?: number;
}): Clip {
  return {
    id: nanoid(),
    trackId: payload.trackId,
    type: payload.type,
    name: normalizeClipName(payload.name),
    startTime: Math.max(MIN_CLIP_START_TIME, payload.startTime),
    duration: Math.max(MIN_CLIP_DURATION, payload.duration),
    offset: payload.offset ?? DEFAULT_CLIP_OFFSET,
    color: normalizeClipColor(payload.color),
    assetId: payload.assetId ?? null,
    gain: clamp(payload.gain ?? DEFAULT_CLIP_GAIN, MIN_CLIP_GAIN, MAX_CLIP_GAIN),
    fadeIn: Math.max(MIN_FADE_DURATION, payload.fadeIn ?? DEFAULT_FADE_DURATION),
    fadeOut: Math.max(MIN_FADE_DURATION, payload.fadeOut ?? DEFAULT_FADE_DURATION),
    noteIds: [],
  };
}

const createInitialState = (): ClipsState => ({
  byId: {},
  allIds: [],
  selectedClipIds: [],
});

// ═══════════════════════════════════════════════════════════════
// 🏪 SLICE
// ═══════════════════════════════════════════════════════════════

const initialState: ClipsState = createInitialState();

const clipsSlice = createSlice({
  name: 'clips',
  initialState,
  reducers: {
    // ─── CRUD ────────────────────────────────────────────────

    addClip: {
      reducer(state, action: PayloadAction<Clip>) {
        const clip = action.payload;

        // Prevenir duplicados
        if (hasClip(state, clip.id)) return;

        state.byId[clip.id] = clip;
        state.allIds.push(clip.id);
      },
      prepare(payload: {
        trackId: string;
        type: ClipType;
        name: string;
        startTime: number;
        duration: number;
        offset?: number;
        color?: string;
        assetId?: string | null;
        gain?: number;
        fadeIn?: number;
        fadeOut?: number;
      }) {
        return { payload: createClip(payload) };
      },
    },

    removeClip(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!hasClip(state, id)) return;

      delete state.byId[id];
      state.allIds = state.allIds.filter((clipId) => clipId !== id);
      state.selectedClipIds = state.selectedClipIds.filter(
        (clipId) => clipId !== id
      );
    },

    /**
     * Elimina múltiples clips de una vez.
     * Más eficiente que llamar removeClip N veces.
     */
    removeClips(state, action: PayloadAction<string[]>) {
      const idsToRemove = new Set(action.payload);
      if (idsToRemove.size === 0) return;

      for (const id of idsToRemove) {
        delete state.byId[id];
      }

      state.allIds = state.allIds.filter((id) => !idsToRemove.has(id));
      state.selectedClipIds = state.selectedClipIds.filter(
        (id) => !idsToRemove.has(id)
      );
    },

    // ─── POSICIÓN Y TAMAÑO ──────────────────────────────────

    moveClip(
      state,
      action: PayloadAction<{ id: string; startTime: number }>
    ) {
      const clip = state.byId[action.payload.id];
      if (!clip) return;

      clip.startTime = Math.max(MIN_CLIP_START_TIME, action.payload.startTime);
    },

    resizeClip(
      state,
      action: PayloadAction<{ id: string; duration: number }>
    ) {
      const clip = state.byId[action.payload.id];
      if (!clip) return;

      clip.duration = Math.max(MIN_CLIP_DURATION, action.payload.duration);
    },

    /**
     * Mueve y redimensiona en una sola acción.
     * Útil para operaciones de trim (arrastrar borde izquierdo).
     */
    moveAndResizeClip(
      state,
      action: PayloadAction<{
        id: string;
        startTime: number;
        duration: number;
        offset?: number;
      }>
    ) {
      const clip = state.byId[action.payload.id];
      if (!clip) return;

      clip.startTime = Math.max(MIN_CLIP_START_TIME, action.payload.startTime);
      clip.duration = Math.max(MIN_CLIP_DURATION, action.payload.duration);

      if (action.payload.offset !== undefined) {
        clip.offset = Math.max(0, action.payload.offset);
      }
    },

    setClipOffset(
      state,
      action: PayloadAction<{ id: string; offset: number }>
    ) {
      const clip = state.byId[action.payload.id];
      if (!clip) return;

      clip.offset = Math.max(0, action.payload.offset);
    },

    /**
     * Reasigna un clip a otra pista.
     * El thunk deleteTrackCascade elimina clips, pero mover
     * entre pistas requiere actualizar el trackId del clip.
     */
    setClipTrack(
      state,
      action: PayloadAction<{ id: string; trackId: string }>
    ) {
      const clip = state.byId[action.payload.id];
      if (!clip) return;

      clip.trackId = action.payload.trackId;
    },

    // ─── GAIN Y FADES ───────────────────────────────────────

    setClipGain(
      state,
      action: PayloadAction<{ id: string; gain: number }>
    ) {
      const clip = state.byId[action.payload.id];
      if (!clip) return;

      clip.gain = clamp(action.payload.gain, MIN_CLIP_GAIN, MAX_CLIP_GAIN);
    },

    setClipFadeIn(
      state,
      action: PayloadAction<{ id: string; fadeIn: number }>
    ) {
      const clip = state.byId[action.payload.id];
      if (!clip) return;

      const maxFadeIn = clip.duration - clip.fadeOut;
      clip.fadeIn = clamp(
        action.payload.fadeIn,
        MIN_FADE_DURATION,
        Math.max(MIN_FADE_DURATION, maxFadeIn)
      );
    },

    setClipFadeOut(
      state,
      action: PayloadAction<{ id: string; fadeOut: number }>
    ) {
      const clip = state.byId[action.payload.id];
      if (!clip) return;

      const maxFadeOut = clip.duration - clip.fadeIn;
      clip.fadeOut = clamp(
        action.payload.fadeOut,
        MIN_FADE_DURATION,
        Math.max(MIN_FADE_DURATION, maxFadeOut)
      );
    },

    // ─── NOMBRE Y COLOR ─────────────────────────────────────

    renameClip(
      state,
      action: PayloadAction<{ id: string; name: string }>
    ) {
      const clip = state.byId[action.payload.id];
      if (!clip) return;

      clip.name = normalizeClipName(action.payload.name);
    },

    setClipColor(
      state,
      action: PayloadAction<{ id: string; color: string }>
    ) {
      const clip = state.byId[action.payload.id];
      if (!clip) return;

      clip.color = normalizeClipColor(action.payload.color);
    },

    // ─── ASSET ──────────────────────────────────────────────

    setClipAsset(
      state,
      action: PayloadAction<{ id: string; assetId: string | null }>
    ) {
      const clip = state.byId[action.payload.id];
      if (!clip) return;

      clip.assetId = action.payload.assetId;
    },

    // ─── MIDI NOTES (referencias) ───────────────────────────

    addNoteIdToClip(
      state,
      action: PayloadAction<{ clipId: string; noteId: string }>
    ) {
      const clip = state.byId[action.payload.clipId];
      if (!clip) return;

      if (!clip.noteIds.includes(action.payload.noteId)) {
        clip.noteIds.push(action.payload.noteId);
      }
    },

    removeNoteIdFromClip(
      state,
      action: PayloadAction<{ clipId: string; noteId: string }>
    ) {
      const clip = state.byId[action.payload.clipId];
      if (!clip) return;

      clip.noteIds = clip.noteIds.filter(
        (noteId) => noteId !== action.payload.noteId
      );
    },

    // ─── SELECCIÓN ──────────────────────────────────────────

    selectClips(state, action: PayloadAction<string[]>) {
      // Solo incluir IDs que realmente existan
      state.selectedClipIds = action.payload.filter((id) =>
        hasClip(state, id)
      );
    },

    toggleClipSelection(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!hasClip(state, id)) return;

      const index = state.selectedClipIds.indexOf(id);
      if (index >= 0) {
        state.selectedClipIds.splice(index, 1);
      } else {
        state.selectedClipIds.push(id);
      }
    },

    deselectAllClips(state) {
      state.selectedClipIds = [];
    },

    /**
     * Selecciona todos los clips de una pista específica.
     */
    selectClipsByTrack(state, action: PayloadAction<string>) {
      const trackId = action.payload;

      state.selectedClipIds = state.allIds.filter((id) => {
        const clip = state.byId[id];
        return clip?.trackId === trackId;
      });
    },

    // ─── BULK / PROYECTO ────────────────────────────────────

    /**
     * Elimina todos los clips que pertenecen a un track.
     * Llamado desde deleteTrackCascade o similar.
     */
    removeClipsByTrack(state, action: PayloadAction<string>) {
      const trackId = action.payload;
      const toRemove = new Set<string>();

      for (const id of state.allIds) {
        if (state.byId[id]?.trackId === trackId) {
          toRemove.add(id);
        }
      }

      if (toRemove.size === 0) return;

      for (const id of toRemove) {
        delete state.byId[id];
      }

      state.allIds = state.allIds.filter((id) => !toRemove.has(id));
      state.selectedClipIds = state.selectedClipIds.filter(
        (id) => !toRemove.has(id)
      );
    },

    /**
     * Carga completa de clips (abrir proyecto).
     */
    replaceClips(
      state,
      action: PayloadAction<{
        clips: Clip[];
        selectedClipIds?: string[];
      }>
    ) {
      state.byId = {};
      state.allIds = [];

      for (const clip of action.payload.clips) {
        if (state.byId[clip.id]) continue;

        state.byId[clip.id] = clip;
        state.allIds.push(clip.id);
      }

      const requestedSelected = action.payload.selectedClipIds ?? [];
      state.selectedClipIds = requestedSelected.filter((id) =>
        hasClip(state, id)
      );
    },

    resetClips() {
      return createInitialState();
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: ACCIONES
// ═══════════════════════════════════════════════════════════════

export const {
  // CRUD
  addClip,
  removeClip,
  removeClips,
  // Posición y tamaño
  moveClip,
  resizeClip,
  moveAndResizeClip,
  setClipOffset,
  setClipTrack,
  // Gain y fades
  setClipGain,
  setClipFadeIn,
  setClipFadeOut,
  // Nombre y color
  renameClip,
  setClipColor,
  // Asset
  setClipAsset,
  // MIDI notes
  addNoteIdToClip,
  removeNoteIdFromClip,
  // Selección
  selectClips,
  toggleClipSelection,
  deselectAllClips,
  selectClipsByTrack,
  // Bulk / proyecto
  removeClipsByTrack,
  replaceClips,
  resetClips,
} = clipsSlice.actions;

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: SELECTORES BÁSICOS
// ═══════════════════════════════════════════════════════════════

export const selectClipsState = (state: { clips: ClipsState }) =>
  state.clips;

export const selectClipById = (
  state: { clips: ClipsState },
  clipId: string
) => state.clips.byId[clipId] ?? null;

export const selectAllClipIds = (state: { clips: ClipsState }) =>
  state.clips.allIds;

export const selectSelectedClipIds = (state: { clips: ClipsState }) =>
  state.clips.selectedClipIds;

export default clipsSlice.reducer;