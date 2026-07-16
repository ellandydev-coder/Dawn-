/**
 * Selection
 * ---------
 * Estado de la selección actual en la UI.
 */

import type { TrackId, ClipId, Seconds } from '@domain/types/audio.types';

export interface Selection {
  trackIds: readonly TrackId[];
  clipIds: readonly ClipId[];
  noteIds: readonly string[];
  
  timeRange?: {
    readonly startSeconds: Seconds;
    readonly endSeconds: Seconds;
  };
}

export const EMPTY_SELECTION: Selection = {
  trackIds: [],
  clipIds: [],
  noteIds: [],
};

/** ¿Hay algo seleccionado? */
export const hasSelection = (s: Selection): boolean =>
  s.trackIds.length > 0 ||
  s.clipIds.length > 0 ||
  s.noteIds.length > 0 ||
  s.timeRange !== undefined;