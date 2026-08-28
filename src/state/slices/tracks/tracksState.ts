// src/state/slices/tracks/tracksState.ts

import type { Track } from '@domain/models/Track';

export interface TracksState {
  byId: Record<string, Track>;
  allIds: string[];
  selectedTrackId: string | null;
}

export function createTracksInitialState(): TracksState {
  return {
    byId: {},
    allIds: [],
    selectedTrackId: null,
  };
}