// src/state/slices/tracks/tracksHelpers.ts

import { nanoid } from 'nanoid';
import type { Track, TrackType } from '@domain/models/Track';
import type { TracksState } from './tracksState';
import {
  DEFAULT_TRACK_COLOR,
  DEFAULT_TRACK_HEIGHT,
  DEFAULT_TRACK_PAN,
  DEFAULT_TRACK_VOLUME,
  DUPLICATE_SUFFIX,
  FALLBACK_TRACK_NAME,
} from './tracksConstants';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeTrackName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : FALLBACK_TRACK_NAME;
}

export function normalizeTrackColor(color?: string): string {
  const trimmed = color?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_TRACK_COLOR;
}

export function createTrack(payload: {
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

export function duplicateTrackData(source: Track): Track {
  return {
    ...source,
    id: nanoid(),
    name: source.name + DUPLICATE_SUFFIX,
    clipIds: [],
    soloed: false,
    armed: false,
  };
}

export function hasTrack(state: TracksState, id: string): boolean {
  return id in state.byId;
}

export function isValidTrack(track: unknown): track is Track {
  return (
    typeof track === 'object' &&
    track !== null &&
    typeof (track as Track).id === 'string' &&
    (track as Track).id.length > 0 &&
    typeof (track as Track).name === 'string' &&
    typeof (track as Track).type === 'string'
  );
}

/** Limpia referencias outputTrackId que apuntan al track eliminado. */
export function cleanupOutputReferences(
  state: TracksState,
  removedId: string
): void {
  for (const trackId of state.allIds) {
    const track = state.byId[trackId];
    if (track?.outputTrackId === removedId) {
      track.outputTrackId = null;
    }
  }
}