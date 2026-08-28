// src/state/slices/tracks/tracksSelectors.ts

import type { TracksState } from './tracksState';

type TracksRoot = { tracks: TracksState };

export const selectTracksState = (state: TracksRoot) => state.tracks;

export const selectTrackById = (state: TracksRoot, trackId: string) =>
  state.tracks.byId[trackId] ?? null;

export const selectTrackIds = (state: TracksRoot) => state.tracks.allIds;

export const selectSelectedTrackId = (state: TracksRoot) =>
  state.tracks.selectedTrackId;