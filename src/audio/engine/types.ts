// src/audio/engine/types.ts

import type { AudioContextManager } from './AudioContextManager';

export type AudioEngineState =
  | 'uninitialized'
  | 'initializing'
  | 'ready'
  | 'suspended'
  | 'error'
  | 'disposed';

export interface AudioEngineConfig {
  sampleRate?: number;
  latencyHint?: AudioContextLatencyCategory | number;
  fadeTime?: number;
  initialVolume?: number;
  initialMuted?: boolean;
  verbose?: boolean;
  contextManager?: AudioContextManager;
  masterLimiterEnabled?: boolean;
  masterHeadroomDb?: number;
}

export interface AudioEngineStats {
  state: AudioEngineState;
  sampleRate: number;
  currentTime: number;
  audioOutputTime: number;
  baseLatency: number;
  outputLatency: number;
  isMuted: boolean;
  masterVolume: number;
  contextState: AudioContextState | 'uninitialized';
  lastError: string | null;
  masterGainReductionDb: number;
}

export type AudioEngineEvent =
  | { type: 'stateChanged'; state: AudioEngineState; previous: AudioEngineState }
  | { type: 'initialized'; sampleRate: number }
  | { type: 'volumeChanged'; volume: number }
  | { type: 'muteChanged'; muted: boolean }
  | { type: 'error'; error: Error; phase: 'init' | 'dispose' | 'runtime' }
  | { type: 'disposed' };

export type AudioEngineListener = (event: AudioEngineEvent) => void;

/** Config ya resuelta (sin contextManager inyectable). */
export type ResolvedAudioEngineConfig = Required<
  Omit<AudioEngineConfig, 'contextManager'>
>;