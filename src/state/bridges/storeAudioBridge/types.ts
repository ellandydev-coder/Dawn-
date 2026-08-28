// src/state/bridges/storeAudioBridge/types.ts

import type { TransportScheduler } from '@audio/scheduling/TransportScheduler';

export interface StoreAudioBridgeConfig {
  /** Habilitar logs (default: true en dev) */
  verbose?: boolean;
  /** Scheduler custom (útil para testing) */
  scheduler?: TransportScheduler;
}

export interface StoreAudioBridgeStats {
  isAttached: boolean;
  isPlaying: boolean;
  isRecording: boolean;
  syncCount: number;
  lastSyncAt: number;
  schedulerRunning: boolean;
}

export type StoreAudioBridgeEvent =
  | { type: 'attached' }
  | { type: 'detached' }
  | { type: 'initialStateSynced'; trackCount: number }
  | { type: 'transportChanged'; isPlaying: boolean; isRecording: boolean }
  | { type: 'seekApplied'; toSec: number }
  | { type: 'loopChanged'; enabled: boolean; start: number; end: number }
  | { type: 'error'; error: Error };

export type StoreAudioBridgeListener = (event: StoreAudioBridgeEvent) => void;

/** Snapshot de campos de transport que observamos con diff. */
export interface TransportSnapshot {
  isPlaying: boolean;
  isRecording: boolean;
  editCursorSeconds: number;
  loopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
}