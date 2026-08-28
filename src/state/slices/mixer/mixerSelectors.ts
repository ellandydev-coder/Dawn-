// src/state/slices/mixer/mixerSelectors.ts

import type { MixerSliceState } from './mixerState';

type MixerRoot = { mixer: MixerSliceState };

export const selectMixerSliceState = (state: MixerRoot) => state.mixer;

export const selectMixerGlobal = (state: MixerRoot) => state.mixer.global;

export const selectMixerChannels = (state: MixerRoot) => state.mixer.channels;

export const selectMixerCpuUsage = (state: MixerRoot) => state.mixer.cpuUsage;

export const selectMixerChannelByTrackId = (
  state: MixerRoot,
  trackId: string
) => state.mixer.channels[trackId] ?? null;