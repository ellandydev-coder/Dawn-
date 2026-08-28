// src/state/slices/mixer/mixerSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  type MixerChannel,
  type MixerState as MixerModelState,
  createMixerChannel,
} from '@domain/models/MixerChannel';
import type { PanLaw } from '@domain/enums/PanLaw';
import { createMixerInitialState } from './mixerState';
import {
  MAX_CHANNEL_WIDTH,
  MAX_CPU_USAGE,
  MAX_HEADROOM,
  MAX_PEAK_HOLD,
  MAX_VOLUME,
  MIN_CHANNEL_WIDTH,
  MIN_CPU_USAGE,
  MIN_HEADROOM,
  MIN_PEAK_HOLD,
  MIN_VOLUME,
} from './mixerConstants';
import { clamp, hasChannel } from './mixerHelpers';

const initialState = createMixerInitialState();

const mixerSlice = createSlice({
  name: 'mixer',
  initialState,
  reducers: {
    // ─── MASTER VOLUME / MUTE ───────────────────────────────

    setMasterVolume(state, action: PayloadAction<number>) {
      state.global.masterVolume = clamp(action.payload, MIN_VOLUME, MAX_VOLUME);
    },

    toggleMasterMute(state) {
      state.global.masterMuted = !state.global.masterMuted;
    },

    setMasterMuted(state, action: PayloadAction<boolean>) {
      state.global.masterMuted = action.payload;
    },

    // ─── MASTER LIMITER ─────────────────────────────────────

    toggleMasterLimiter(state) {
      state.global.masterLimiterEnabled = !state.global.masterLimiterEnabled;
    },

    setMasterLimiterEnabled(state, action: PayloadAction<boolean>) {
      state.global.masterLimiterEnabled = action.payload;
    },

    setMasterHeadroom(state, action: PayloadAction<number>) {
      state.global.masterHeadroom = clamp(
        action.payload,
        MIN_HEADROOM,
        MAX_HEADROOM
      );
    },

    // ─── MIXER CONFIG ───────────────────────────────────────

    setPanLaw(state, action: PayloadAction<PanLaw>) {
      state.global.panLaw = action.payload;
    },

    setSoloIsExclusive(state, action: PayloadAction<boolean>) {
      state.global.soloIsExclusive = action.payload;
    },

    setChannelWidth(state, action: PayloadAction<number>) {
      state.global.channelWidth = clamp(
        Math.round(action.payload),
        MIN_CHANNEL_WIDTH,
        MAX_CHANNEL_WIDTH
      );
    },

    toggleShowSends(state) {
      state.global.showSends = !state.global.showSends;
    },

    toggleShowInserts(state) {
      state.global.showInserts = !state.global.showInserts;
    },

    // ─── CHANNEL CRUD ───────────────────────────────────────

    addChannel(state, action: PayloadAction<string>) {
      const trackId = action.payload;
      if (hasChannel(state, trackId)) return;
      state.channels[trackId] = createMixerChannel(trackId);
    },

    addChannels(state, action: PayloadAction<string[]>) {
      for (const trackId of action.payload) {
        if (hasChannel(state, trackId)) continue;
        state.channels[trackId] = createMixerChannel(trackId);
      }
    },

    removeChannel(state, action: PayloadAction<string>) {
      delete state.channels[action.payload];
    },

    removeChannels(state, action: PayloadAction<string[]>) {
      for (const trackId of action.payload) {
        delete state.channels[trackId];
      }
    },

    // ─── CHANNEL ROUTING ────────────────────────────────────

    setChannelOutput(
      state,
      action: PayloadAction<{ trackId: string; outputBusId: string }>
    ) {
      const ch = state.channels[action.payload.trackId];
      if (!ch) return;
      ch.outputBusId = action.payload.outputBusId;
    },

    // ─── CHANNEL INSERTS ────────────────────────────────────

    addInsertToChannel(
      state,
      action: PayloadAction<{
        trackId: string;
        insertId: string;
        index?: number;
      }>
    ) {
      const ch = state.channels[action.payload.trackId];
      if (!ch) return;

      const { insertId, index } = action.payload;
      if (ch.insertIds.includes(insertId)) return;

      if (index !== undefined && index < ch.insertIds.length) {
        ch.insertIds.splice(index, 0, insertId);
      } else {
        ch.insertIds.push(insertId);
      }
    },

    removeInsertFromChannel(
      state,
      action: PayloadAction<{ trackId: string; insertId: string }>
    ) {
      const ch = state.channels[action.payload.trackId];
      if (!ch) return;
      ch.insertIds = ch.insertIds.filter(
        (id) => id !== action.payload.insertId
      );
    },

    reorderInsert(
      state,
      action: PayloadAction<{
        trackId: string;
        insertId: string;
        toIndex: number;
      }>
    ) {
      const ch = state.channels[action.payload.trackId];
      if (!ch) return;

      const { insertId, toIndex } = action.payload;
      const fromIndex = ch.insertIds.indexOf(insertId);
      if (fromIndex === -1) return;

      ch.insertIds.splice(fromIndex, 1);
      const bounded = clamp(toIndex, 0, ch.insertIds.length);
      ch.insertIds.splice(bounded, 0, insertId);
    },

    toggleInsertsBypassed(state, action: PayloadAction<string>) {
      const ch = state.channels[action.payload];
      if (!ch) return;
      ch.insertsBypassed = !ch.insertsBypassed;
    },

    setInsertsBypassed(
      state,
      action: PayloadAction<{ trackId: string; bypassed: boolean }>
    ) {
      const ch = state.channels[action.payload.trackId];
      if (!ch) return;
      ch.insertsBypassed = action.payload.bypassed;
    },

    // ─── CHANNEL SENDS ──────────────────────────────────────

    addSendToChannel(
      state,
      action: PayloadAction<{ trackId: string; sendId: string }>
    ) {
      const ch = state.channels[action.payload.trackId];
      if (!ch) return;
      if (ch.sendIds.includes(action.payload.sendId)) return;
      ch.sendIds.push(action.payload.sendId);
    },

    removeSendFromChannel(
      state,
      action: PayloadAction<{ trackId: string; sendId: string }>
    ) {
      const ch = state.channels[action.payload.trackId];
      if (!ch) return;
      ch.sendIds = ch.sendIds.filter((id) => id !== action.payload.sendId);
    },

    // ─── CHANNEL METERING ───────────────────────────────────

    setMeterPreFader(
      state,
      action: PayloadAction<{ trackId: string; preFader: boolean }>
    ) {
      const ch = state.channels[action.payload.trackId];
      if (!ch) return;
      ch.meterPreFader = action.payload.preFader;
    },

    setPeakHoldSeconds(
      state,
      action: PayloadAction<{ trackId: string; seconds: number }>
    ) {
      const ch = state.channels[action.payload.trackId];
      if (!ch) return;
      ch.peakHoldSeconds = clamp(
        action.payload.seconds,
        MIN_PEAK_HOLD,
        MAX_PEAK_HOLD
      );
    },

    // ─── CHANNEL UI ─────────────────────────────────────────

    toggleChannelAutomation(state, action: PayloadAction<string>) {
      const ch = state.channels[action.payload];
      if (!ch) return;
      ch.showAutomation = !ch.showAutomation;
    },

    setChannelAutomation(
      state,
      action: PayloadAction<{ trackId: string; show: boolean }>
    ) {
      const ch = state.channels[action.payload.trackId];
      if (!ch) return;
      ch.showAutomation = action.payload.show;
    },

    // ─── RUNTIME ────────────────────────────────────────────

    setCpuUsage(state, action: PayloadAction<number>) {
      state.cpuUsage = clamp(action.payload, MIN_CPU_USAGE, MAX_CPU_USAGE);
    },

    // ─── BULK / PROYECTO ────────────────────────────────────

    replaceChannels(state, action: PayloadAction<MixerChannel[]>) {
      state.channels = {};
      for (const channel of action.payload) {
        state.channels[channel.trackId] = channel;
      }
    },

    loadMixerConfig(state, action: PayloadAction<Partial<MixerModelState>>) {
      const config = action.payload;

      if (config.masterVolume !== undefined) {
        state.global.masterVolume = clamp(
          config.masterVolume,
          MIN_VOLUME,
          MAX_VOLUME
        );
      }
      if (config.masterMuted !== undefined) {
        state.global.masterMuted = config.masterMuted;
      }
      if (config.masterLimiterEnabled !== undefined) {
        state.global.masterLimiterEnabled = config.masterLimiterEnabled;
      }
      if (config.masterHeadroom !== undefined) {
        state.global.masterHeadroom = clamp(
          config.masterHeadroom,
          MIN_HEADROOM,
          MAX_HEADROOM
        );
      }
      if (config.soloIsExclusive !== undefined) {
        state.global.soloIsExclusive = config.soloIsExclusive;
      }
      if (config.panLaw !== undefined) {
        state.global.panLaw = config.panLaw;
      }
      if (config.channelWidth !== undefined) {
        state.global.channelWidth = clamp(
          Math.round(config.channelWidth),
          MIN_CHANNEL_WIDTH,
          MAX_CHANNEL_WIDTH
        );
      }
      if (config.showSends !== undefined) {
        state.global.showSends = config.showSends;
      }
      if (config.showInserts !== undefined) {
        state.global.showInserts = config.showInserts;
      }
    },

    resetMixer() {
      return createMixerInitialState();
    },
  },
});

export const {
  setMasterVolume,
  toggleMasterMute,
  setMasterMuted,
  toggleMasterLimiter,
  setMasterLimiterEnabled,
  setMasterHeadroom,
  setPanLaw,
  setSoloIsExclusive,
  setChannelWidth,
  toggleShowSends,
  toggleShowInserts,
  addChannel,
  addChannels,
  removeChannel,
  removeChannels,
  setChannelOutput,
  addInsertToChannel,
  removeInsertFromChannel,
  reorderInsert,
  toggleInsertsBypassed,
  setInsertsBypassed,
  addSendToChannel,
  removeSendFromChannel,
  setMeterPreFader,
  setPeakHoldSeconds,
  toggleChannelAutomation,
  setChannelAutomation,
  setCpuUsage,
  replaceChannels,
  loadMixerConfig,
  resetMixer,
} = mixerSlice.actions;

export default mixerSlice.reducer;

export type { MixerSliceState } from './mixerState';
export {
  selectMixerSliceState,
  selectMixerGlobal,
  selectMixerChannels,
  selectMixerCpuUsage,
  selectMixerChannelByTrackId,
} from './mixerSelectors';