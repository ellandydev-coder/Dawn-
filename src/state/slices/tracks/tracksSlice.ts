import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { nanoid } from 'nanoid';
import type { Track, TrackType } from '@domain/models/Track';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface TracksState {
  byId: Record<string, Track>;
  allIds: string[];
  selectedTrackId: string | null;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const DEFAULT_TRACK_COLOR = '#7A8CFF';
const DEFAULT_TRACK_VOLUME = 1.0;
const DEFAULT_TRACK_PAN = 0;
const DEFAULT_TRACK_HEIGHT = 80;

const MIN_VOLUME = 0;
const MAX_VOLUME = 1;
const MIN_PAN = -1;
const MAX_PAN = 1;
const MIN_TRACK_HEIGHT = 72;
const MAX_TRACK_HEIGHT = 320;

const FALLBACK_TRACK_NAME = 'Untitled Track';
const DUPLICATE_SUFFIX = ' (copy)';

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

const createInitialState = (): TracksState => ({
  byId: {},
  allIds: [],
  selectedTrackId: null,
});

const initialState: TracksState = createInitialState();

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeTrackName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : FALLBACK_TRACK_NAME;
}

function normalizeTrackColor(color?: string): string {
  const trimmed = color?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_TRACK_COLOR;
}

function createTrack(payload: {
  name: string;
  type: TrackType;
  color?: string;
}): Track {
  return {
    id: nanoid(),
    name: normalizeTrackName(payload.name),
    type: payload.type,
    color: normalizeTrackColor(payload.color),
    volume: DEFAULT_TRACK_VOLUME,
    pan: DEFAULT_TRACK_PAN,
    muted: false,
    soloed: false,
    armed: false,
    height: DEFAULT_TRACK_HEIGHT,
    clipIds: [],
    effectChainId: null,
    outputTrackId: null,
  };
}

function duplicateTrackData(source: Track): Track {
  return {
    ...source,
    id: nanoid(),
    name: source.name + DUPLICATE_SUFFIX,
    // Los clips NO se duplican (referencias vacías)
    clipIds: [],
    // Reset flags temporales
    soloed: false,
    armed: false,
  };
}

function hasTrack(state: TracksState, id: string): boolean {
  return id in state.byId;
}

function isValidTrack(track: unknown): track is Track {
  return (
    typeof track === 'object' &&
    track !== null &&
    typeof (track as Track).id === 'string' &&
    (track as Track).id.length > 0 &&
    typeof (track as Track).name === 'string' &&
    typeof (track as Track).type === 'string'
  );
}

/** Elimina cualquier referencia a `id` en `outputTrackId` de otras tracks */
function cleanupOutputReferences(state: TracksState, removedId: string): void {
  for (const trackId of state.allIds) {
    const track = state.byId[trackId];
    if (track?.outputTrackId === removedId) {
      track.outputTrackId = null;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 SLICE
// ═══════════════════════════════════════════════════════════════

const tracksSlice = createSlice({
  name: 'tracks',
  initialState,
  reducers: {
    // ─── Crear ────────────────────────────────────────────────
    addTrack: {
      reducer(state, action: PayloadAction<Track>) {
        const track = action.payload;
        if (hasTrack(state, track.id)) return;

        state.byId[track.id] = track;
        state.allIds.push(track.id);
      },
      prepare(payload: { name: string; type: TrackType; color?: string }) {
        return { payload: createTrack(payload) };
      },
    },

    /** Duplica una track existente (sin sus clips) */
    duplicateTrack: {
      reducer(
        state,
        action: PayloadAction<{ sourceId: string; newTrack: Track }>
      ) {
        const { sourceId, newTrack } = action.payload;
        if (!hasTrack(state, sourceId)) return;
        if (hasTrack(state, newTrack.id)) return;

        state.byId[newTrack.id] = newTrack;

        // Insertar justo después del source
        const sourceIndex = state.allIds.indexOf(sourceId);
        state.allIds.splice(sourceIndex + 1, 0, newTrack.id);
      },
      prepare(sourceId: string, sourceTrack: Track) {
        return {
          payload: {
            sourceId,
            newTrack: duplicateTrackData(sourceTrack),
          },
        };
      },
    },

    // ─── Eliminar ─────────────────────────────────────────────
    removeTrack(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!hasTrack(state, id)) return;

      delete state.byId[id];
      state.allIds = state.allIds.filter((trackId) => trackId !== id);

      if (state.selectedTrackId === id) {
        state.selectedTrackId = null;
      }

      cleanupOutputReferences(state, id);
    },

    // ─── Propiedades básicas ──────────────────────────────────
    renameTrack(
      state,
      action: PayloadAction<{ id: string; name: string }>
    ) {
      const track = state.byId[action.payload.id];
      if (!track) return;
      track.name = normalizeTrackName(action.payload.name);
    },

    setTrackColor(
      state,
      action: PayloadAction<{ id: string; color: string }>
    ) {
      const track = state.byId[action.payload.id];
      if (!track) return;
      track.color = normalizeTrackColor(action.payload.color);
    },

    setTrackType(
      state,
      action: PayloadAction<{ id: string; type: TrackType }>
    ) {
      const track = state.byId[action.payload.id];
      if (!track) return;
      track.type = action.payload.type;
    },

    // ─── Audio ────────────────────────────────────────────────
    setTrackVolume(
      state,
      action: PayloadAction<{ id: string; volume: number }>
    ) {
      const track = state.byId[action.payload.id];
      if (!track) return;
      track.volume = clamp(action.payload.volume, MIN_VOLUME, MAX_VOLUME);
    },

    setTrackPan(
      state,
      action: PayloadAction<{ id: string; pan: number }>
    ) {
      const track = state.byId[action.payload.id];
      if (!track) return;
      track.pan = clamp(action.payload.pan, MIN_PAN, MAX_PAN);
    },

    // ─── UI ───────────────────────────────────────────────────
    setTrackHeight(
      state,
      action: PayloadAction<{ id: string; height: number }>
    ) {
      const track = state.byId[action.payload.id];
      if (!track) return;
      track.height = clamp(
        action.payload.height,
        MIN_TRACK_HEIGHT,
        MAX_TRACK_HEIGHT
      );
    },

    // ─── Routing ──────────────────────────────────────────────
    setTrackOutputTrackId(
      state,
      action: PayloadAction<{ id: string; outputTrackId: string | null }>
    ) {
      const track = state.byId[action.payload.id];
      if (!track) return;

      const { outputTrackId } = action.payload;
      // Evitar auto-referencia
      track.outputTrackId = outputTrackId === track.id ? null : outputTrackId;
    },

    // ─── Toggle flags ─────────────────────────────────────────
    toggleMute(state, action: PayloadAction<string>) {
      const track = state.byId[action.payload];
      if (!track) return;
      track.muted = !track.muted;
    },

    toggleSolo(state, action: PayloadAction<string>) {
      const track = state.byId[action.payload];
      if (!track) return;
      track.soloed = !track.soloed;
    },

    toggleArm(state, action: PayloadAction<string>) {
      const track = state.byId[action.payload];
      if (!track) return;
      track.armed = !track.armed;
    },

    /**
     * Solo exclusivo: activa solo en `id` y lo desactiva en todas las demás.
     * Si `id` ya era el único con solo, lo desactiva completamente.
     */
    soloExclusive(state, action: PayloadAction<string>) {
      const id = action.payload;
      const track = state.byId[id];
      if (!track) return;

      const wasOnlySoloed =
        track.soloed &&
        state.allIds.every(
          (tid) => tid === id || !state.byId[tid]?.soloed
        );

      for (const tid of state.allIds) {
        const t = state.byId[tid];
        if (!t) continue;
        t.soloed = wasOnlySoloed ? false : tid === id;
      }
    },

    /** Quita el solo de TODAS las tracks */
    clearAllSolo(state) {
      for (const tid of state.allIds) {
        const t = state.byId[tid];
        if (t) t.soloed = false;
      }
    },

    // ─── Selección ────────────────────────────────────────────
    selectTrack(state, action: PayloadAction<string | null>) {
      const id = action.payload;
      state.selectedTrackId = id && hasTrack(state, id) ? id : null;
    },

    // ─── Clips ────────────────────────────────────────────────
    addClipIdToTrack(
      state,
      action: PayloadAction<{ trackId: string; clipId: string }>
    ) {
      const { trackId, clipId } = action.payload;
      const track = state.byId[trackId];
      if (!track) return;

      if (!track.clipIds.includes(clipId)) {
        track.clipIds.push(clipId);
      }
    },

    removeClipIdFromTrack(
      state,
      action: PayloadAction<{ trackId: string; clipId: string }>
    ) {
      const { trackId, clipId } = action.payload;
      const track = state.byId[trackId];
      if (!track) return;

      track.clipIds = track.clipIds.filter((id) => id !== clipId);
    },

    // ─── Ordenación ───────────────────────────────────────────
    moveTrack(
      state,
      action: PayloadAction<{ trackId: string; toIndex: number }>
    ) {
      const { trackId, toIndex } = action.payload;
      const fromIndex = state.allIds.indexOf(trackId);
      if (fromIndex === -1) return;

      const boundedToIndex = clamp(toIndex, 0, state.allIds.length - 1);
      if (fromIndex === boundedToIndex) return;

      state.allIds.splice(fromIndex, 1);
      state.allIds.splice(boundedToIndex, 0, trackId);
    },

    /**
     * Reordena múltiples tracks de una vez.
     * IDs no válidos se ignoran; IDs faltantes se mantienen al final.
     */
    reorderTracks(state, action: PayloadAction<string[]>) {
      const newOrder = action.payload.filter((id) => hasTrack(state, id));
      const missing = state.allIds.filter((id) => !newOrder.includes(id));
      state.allIds = [...newOrder, ...missing];
    },

    // ─── Reemplazo total (carga de proyecto) ──────────────────
    replaceTracks(
      state,
      action: PayloadAction<{
        tracks: Track[];
        selectedTrackId?: string | null;
      }>
    ) {
      state.byId = {};
      state.allIds = [];

      for (const track of action.payload.tracks) {
        if (!isValidTrack(track)) continue;
        if (state.byId[track.id]) continue;

        state.byId[track.id] = track;
        state.allIds.push(track.id);
      }

      const requestedSelectedId = action.payload.selectedTrackId ?? null;
      state.selectedTrackId =
        requestedSelectedId && state.byId[requestedSelectedId]
          ? requestedSelectedId
          : null;
    },

    // ─── Reset ────────────────────────────────────────────────
    resetTracks() {
      return createInitialState();
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 🎯 EXPORT
// ═══════════════════════════════════════════════════════════════

export const {
  addTrack,
  duplicateTrack,
  removeTrack,
  renameTrack,
  setTrackColor,
  setTrackType,
  setTrackVolume,
  setTrackPan,
  setTrackHeight,
  setTrackOutputTrackId,
  toggleMute,
  toggleSolo,
  toggleArm,
  soloExclusive,
  clearAllSolo,
  selectTrack,
  addClipIdToTrack,
  removeClipIdFromTrack,
  moveTrack,
  reorderTracks,
  replaceTracks,
  resetTracks,
} = tracksSlice.actions;

export default tracksSlice.reducer;

// ═══════════════════════════════════════════════════════════════
// 🎯 SELECTORES BÁSICOS (los memoizados están en @state/selectors)
// ═══════════════════════════════════════════════════════════════

export const selectTracksState = (state: { tracks: TracksState }) =>
  state.tracks;

export const selectTrackById = (
  state: { tracks: TracksState },
  trackId: string
) => state.tracks.byId[trackId] ?? null;

export const selectTrackIds = (state: { tracks: TracksState }) =>
  state.tracks.allIds;

export const selectSelectedTrackId = (state: { tracks: TracksState }) =>
  state.tracks.selectedTrackId;