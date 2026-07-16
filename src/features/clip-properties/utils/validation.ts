// src/features/clip-properties/utils/validation.ts
// ═══════════════════════════════════════════════════════════════
// 🛠️ Helpers de estado y validación del draft
// ═══════════════════════════════════════════════════════════════

import type { Clip } from '@domain/models/Clip';
import type { EditableState } from '../types';
import { MIN_DURATION } from '../types';

export function clipToEditableState(clip: Clip): EditableState {
  return {
    name: clip.name,
    startTime: clip.startTime,
    duration: clip.duration,
    offset: clip.offset,
    gain: clip.gain,
    fadeIn: clip.fadeIn,
    fadeOut: clip.fadeOut,
  };
}

export function statesEqual(a: EditableState, b: EditableState): boolean {
  return (
    a.name === b.name &&
    a.startTime === b.startTime &&
    a.duration === b.duration &&
    a.offset === b.offset &&
    a.gain === b.gain &&
    a.fadeIn === b.fadeIn &&
    a.fadeOut === b.fadeOut
  );
}

export function validateDraft(draft: EditableState): string | null {
  if (draft.duration < MIN_DURATION) {
    return `La duración debe ser mayor que ${MIN_DURATION}s`;
  }
  if (draft.fadeIn < 0 || draft.fadeOut < 0) {
    return 'Los fades no pueden ser negativos';
  }
  if (draft.fadeIn + draft.fadeOut > draft.duration) {
    return 'Los fades combinados exceden la duración del clip';
  }
  if (draft.startTime < 0) {
    return 'La posición no puede ser negativa';
  }
  if (draft.offset < 0) {
    return 'El offset no puede ser negativo';
  }
  return null;
}