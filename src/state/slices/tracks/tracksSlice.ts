// src/state/slices/tracks/tracksSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Track, TrackType } from '@domain/models/Track';
import { createTracksInitialState } from './tracksState';
import {
  MAX_PAN,
  MAX_TRACK_HEIGHT,
  MAX_VOLUME,
  MIN_PAN,
  MIN_TRACK_HEIGHT,
  MIN_VOLUME,
} from './tracksConstants';
import {
  clamp,
  cleanupOutputReferences,
  createTrack,
  duplicateTrackData,
  hasTrack,
  isValidTrack,
  normalizeTrackColor,
  normalizeTrackName,
} from './tracksHelpers';

const initialState = createTracksInitialState();

const tracksSlice = createSlice({
  name: 'tracks',
  initialState,
  reducers: {
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

    duplicateTrack: {
      reducer(
        state,
        action: PayloadAction<{ sourceId: string; newTrack: Track }>
      ) {
        const { sourceId, newTrack } = action.payload;
        if (!hasTrack(state, sourceId)) return;
        if (hasTrack(state, newTrack.id)) return;

        state.byId[newTrack.id] = newTrack;
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

    renameTrack(state, action: PayloadAction<{ id: string; name: string }>) {
      const track = state.byId[action.payload.id];
      if (!track) return;
      track.name = normalizeTrackName(action.payload.name);
    },

    setTrackColor(state, action: PayloadAction<{ id: string; color: string }>) {
      const track = state.byId[action.payload.id];
      if (!track) return;
      track.color = normalizeTrackColor(action.payload.color);
    },

    setTrackType(state, action: PayloadAction<{ id: string; type: TrackType }>) {
      const track = state.byId[action.payload.id];
      if (!track) return;
      track.type = action.payload.type;
    },

    setTrackVolume(
      state,
      action: PayloadAction<{ id: string; volume: number }>
    ) {
      const track = state.byId[action.payload.id];
      if (!track) return;
      track.volume = clamp(action.payload.volume, MIN_VOLUME, MAX_VOLUME);
    },

    setTrackPan(state, action: PayloadAction<{ id: string; pan: number }>) {
      const track = state.byId[action.payload.id];
      if (!track) return;
      track.pan = clamp(action.payload.pan, MIN_PAN, MAX_PAN);
    },

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

    setTrackOutputTrackId(
      state,
      action: PayloadAction<{ id: string; outputTrackId: string | null }>
    ) {
      const track = state.byId[action.payload.id];
      if (!track) return;
      const { outputTrackId } = action.payload;
      track.outputTrackId = outputTrackId === track.id ? null : outputTrackId;
    },

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

    soloExclusive(state, action: PayloadAction<string>) {
      const id = action.payload;
      const track = state.byId[id];
      if (!track) return;

      const wasOnlySoloed =
        track.soloed &&
        state.allIds.every((tid) => tid === id || !state.byId[tid]?.soloed);

      for (const tid of state.allIds) {
        const t = state.byId[tid];
        if (!t) continue;
        t.soloed = wasOnlySoloed ? false : tid === id;
      }
    },

    clearAllSolo(state) {
      for (const tid of state.allIds) {
        const t = state.byId[tid];
        if (t) t.soloed = false;
      }
    },

    selectTrack(state, action: PayloadAction<string | null>) {
      const id = action.payload;
      state.selectedTrackId = id && hasTrack(state, id) ? id : null;
    },

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

    reorderTracks(state, action: PayloadAction<string[]>) {
      const newOrder = action.payload.filter((id) => hasTrack(state, id));
      const missing = state.allIds.filter((id) => !newOrder.includes(id));
      state.allIds = [...newOrder, ...missing];
    },

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

    resetTracks() {
      return createTracksInitialState();
    },
  },
});

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

export type { TracksState } from './tracksState';
export {
  selectTracksState,
  selectTrackById,
  selectTrackIds,
  selectSelectedTrackId,
} from './tracksSelectors';