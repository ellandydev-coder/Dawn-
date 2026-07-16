// src/audio/graph/master.types.ts

import type { BusNodeConfig, BusNodeStats } from './bus.types';

export interface MasterBusConfig
  extends Omit<BusNodeConfig, 'kind' | 'attachMeter'> {
  /**
   * Limiter activo al crear (default: false).
   * Mapea a `mixerSlice.global.masterLimiterEnabled`.
   */
  limiterEnabled?: boolean;

  /**
   * Headroom en dB (0 a -12). Default: 0.
   * Threshold del limiter = 0 - headroom.
   */
  headroomDb?: number;

  /** Release del limiter en segundos (default: 0.05 = 50ms). */
  limiterRelease?: number;

  /** Attack del limiter en segundos (default: 0.001 = 1ms). */
  limiterAttack?: number;

  /** Ratio del limiter (default: 20). */
  limiterRatio?: number;

  /** Knee del limiter en dB (default: 0 = hard knee). */
  limiterKnee?: number;
}

export interface MasterBusStats extends BusNodeStats {
  limiterEnabled: boolean;
  headroomDb: number;
  thresholdDb: number;
  gainReductionDb: number;
  isCustomLimiter: boolean;
  isConnectedToDestination: boolean;
}

export type MasterBusEvent =
  | { type: 'limiterEnabledChanged'; enabled: boolean }
  | { type: 'headroomChanged'; headroomDb: number; thresholdDb: number }
  | { type: 'customLimiterAttached'; node: AudioNode }
  | { type: 'customLimiterDetached' }
  | { type: 'connectedToDestination' }
  | { type: 'disconnectedFromDestination' };

export type MasterBusListener = (event: MasterBusEvent) => void;

export const DEFAULT_MASTER_CONFIG = {
  limiterEnabled: false,
  headroomDb: 0,
  limiterRelease: 0.05,
  limiterAttack: 0.001,
  limiterRatio: 20,
  limiterKnee: 0,
} as const;

export const HEADROOM_MIN_DB = -12;
export const HEADROOM_MAX_DB = 0;
export const LIMITER_PARAM_TIME = 0.01;

export function clampHeadroom(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(HEADROOM_MIN_DB, Math.min(HEADROOM_MAX_DB, db));
}

export function getMasterErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}