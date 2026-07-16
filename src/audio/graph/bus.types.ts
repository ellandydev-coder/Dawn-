// src/audio/graph/bus.types.ts

import { type PanLaw, DEFAULT_PAN_LAW } from '@domain/enums/PanLaw';

export type BusKind = 'mix' | 'fx' | 'master' | 'aux';

export interface BusNodeConfig {
  kind?: BusKind;
  volume?: number;
  pan?: number;
  trim?: number;
  muted?: boolean;
  panLaw?: PanLaw;
  meterPostFader?: boolean;
  fadeTime?: number;
  attachMeter?: boolean;
  verbose?: boolean;
}

export interface BusNodeStats {
  id: string;
  kind: BusKind;
  volume: number;
  pan: number;
  trim: number;
  muted: boolean;
  panLaw: PanLaw;
  meterPostFader: boolean;
  hasMeter: boolean;
  hasEffectChain: boolean;
    isDisposed: boolean;
  connectionCount: number;
}

export type BusNodeEvent =
  | { type: 'volumeChanged'; volume: number }
  | { type: 'panChanged'; pan: number }
  | { type: 'trimChanged'; trim: number }
  | { type: 'muteChanged'; muted: boolean }
  | { type: 'panLawChanged'; panLaw: PanLaw }
  | { type: 'meterModeChanged'; postFader: boolean }
  | { type: 'effectChainAttached' }
  | { type: 'effectChainDetached' }
  | { type: 'connected'; destination: AudioNode }
  | { type: 'disconnected'; destination?: AudioNode }
  | { type: 'disposed' };

export type BusNodeListener = (event: BusNodeEvent) => void;

export const BUS_DEFAULT_CONFIG: Required<BusNodeConfig> = {
  kind: 'mix',
  volume: 0.8,
  pan: 0,
  trim: 1,
  muted: false,
  panLaw: DEFAULT_PAN_LAW,
  meterPostFader: true,
  fadeTime: 0.01,

    attachMeter: true,
  verbose: import.meta.env?.DEV ?? false,
};

export const BUS_VOLUME_MIN = 0;
export const BUS_VOLUME_MAX = 1;
export const BUS_PAN_MIN = -1;
export const BUS_PAN_MAX = 1;
export const BUS_TRIM_MIN = 0;
export const BUS_TRIM_MAX = 4;
export const BUS_MUTE_FADE_TIME = 0.005;

export function clampBusValue(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

export function getBusErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}