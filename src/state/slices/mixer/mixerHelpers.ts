// src/state/slices/mixer/mixerHelpers.ts

import type { MixerSliceState } from './mixerState';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function hasChannel(state: MixerSliceState, trackId: string): boolean {
  return trackId in state.channels;
}