// src/state/slices/mixer/mixerState.ts

import {
  type MixerChannel,
  type MixerState as MixerModelState,
  createDefaultMixerState,
} from '@domain/models/MixerChannel';

export interface MixerSliceState {
  /** Estado global del mixer (master + configuración) */
  global: MixerModelState;
  /** Canales indexados por trackId */
  channels: Record<string, MixerChannel>;
  /** CPU usage 0-1 (runtime, no persistido) */
  cpuUsage: number;
}

export function createMixerInitialState(): MixerSliceState {
  return {
    global: createDefaultMixerState(),
    channels: {},
    cpuUsage: 0,
  };
}