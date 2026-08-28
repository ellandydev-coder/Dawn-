// src/audio/engine/constants.ts

import type { ResolvedAudioEngineConfig } from './types';

export const DEFAULT_ENGINE_CONFIG: ResolvedAudioEngineConfig = {
  sampleRate: 48000,
  latencyHint: 'interactive',
  fadeTime: 0.01,
  initialVolume: 1,
  initialMuted: false,
  verbose: import.meta.env?.DEV ?? false,
  masterLimiterEnabled: false,
  masterHeadroomDb: 0,
};

export const MASTER_BUS_ID = 'master' as const;