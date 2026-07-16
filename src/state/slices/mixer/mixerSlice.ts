// src/state/slices/mixer/mixerSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  type MixerChannel,
  type MixerState as MixerModelState,
  createMixerChannel,
  createDefaultMixerState,
} from '@domain/models/MixerChannel';
import type { PanLaw } from '@domain/enums/PanLaw';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const MIN_VOLUME = 0;
const MAX_VOLUME = 1;
const MIN_HEADROOM = -12;
const MAX_HEADROOM = 0;
const MIN_PEAK_HOLD = 0;
const MAX_PEAK_HOLD = 10;
const MIN_CHANNEL_WIDTH = 60;
const MAX_CHANNEL_WIDTH = 200;
const MIN_CPU_USAGE = 0;
const MAX_CPU_USAGE = 1;

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface MixerSliceState {
  /** Estado global del mixer (master + configuración) */
  global: MixerModelState;
  /** Canales indexados por trackId */
  channels: Record<string, MixerChannel>;
  /** CPU usage 0-1 (runtime, no persistido) */
  cpuUsage: number;
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function hasChannel(state: MixerSliceState, trackId: string): boolean {
  return trackId in state.channels;
}

const createInitialState = (): MixerSliceState => ({
  global: createDefaultMixerState(),
  channels: {},
  cpuUsage: 0,
});

// ═══════════════════════════════════════════════════════════════
// 🏪 SLICE
// ═══════════════════════════════════════════════════════════════

const initialState: MixerSliceState = createInitialState();

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

    /**
     * Headroom del master en dB (−12 a 0).
     * 0 = sin headroom, −6 = 6dB de margen antes de limiter.
     */
    setMasterHeadroom(state, action: PayloadAction<number>) {
      state.global.masterHeadroom = clamp(
        action.payload,
        MIN_HEADROOM,
        MAX_HEADROOM
      );
    },

    // ─── MIXER CONFIG ───────────────────────────────────────

    /**
     * Pan law del mixer (−3dB, −4.5dB, −6dB, 0dB, custom).
     * Viene de PanLaw enum, validado por Zod en el modelo.
     */
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

    /**
     * Crea un canal de mixer para un track.
     * Idempotente: no hace nada si ya existe.
     */
    addChannel(state, action: PayloadAction<string>) {
      const trackId = action.payload;
      if (hasChannel(state, trackId)) return;

      state.channels[trackId] = createMixerChannel(trackId);
    },

    /**
     * Crea varios canales de una vez.
     * Útil al cargar un proyecto completo.
     */
    addChannels(state, action: PayloadAction<string[]>) {
      for (const trackId of action.payload) {
        if (hasChannel(state, trackId)) continue;
        state.channels[trackId] = createMixerChannel(trackId);
      }
    },

    removeChannel(state, action: PayloadAction<string>) {
      const trackId = action.payload;
      if (!hasChannel(state, trackId)) return;

      delete state.channels[trackId];
    },

    /**
     * Elimina varios canales de una vez.
     * Llamado desde deleteTrackCascade.
     */
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
      action: PayloadAction<{ trackId: string; insertId: string; index?: number }>
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

      const { sendId } = action.payload;
      if (ch.sendIds.includes(sendId)) return;

      ch.sendIds.push(sendId);
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

    /**
     * Pre-fader meter: mide la señal antes del fader de volumen.
     * Post-fader (default): mide lo que realmente sale.
     */
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

    /**
     * CPU usage reportado por AudioEngine (0-1).
     * No se persiste en proyecto.
     */
    setCpuUsage(state, action: PayloadAction<number>) {
      state.cpuUsage = clamp(action.payload, MIN_CPU_USAGE, MAX_CPU_USAGE);
    },

    // ─── BULK / PROYECTO ────────────────────────────────────

    /**
     * Reemplaza todos los canales (abrir proyecto).
     */
    replaceChannels(state, action: PayloadAction<MixerChannel[]>) {
      state.channels = {};

      for (const channel of action.payload) {
        state.channels[channel.trackId] = channel;
      }
    },

    /**
     * Restaura la configuración global del mixer (abrir proyecto).
     * No toca canales ni cpuUsage.
     */
    loadMixerConfig(
      state,
      action: PayloadAction<Partial<MixerModelState>>
    ) {
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
      return createInitialState();
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: ACCIONES
// ═══════════════════════════════════════════════════════════════

export const {
  // Master volume / mute
  setMasterVolume,
  toggleMasterMute,
  setMasterMuted,
  // Master limiter
  toggleMasterLimiter,
  setMasterLimiterEnabled,
  setMasterHeadroom,
  // Mixer config
  setPanLaw,
  setSoloIsExclusive,
  setChannelWidth,
  toggleShowSends,
  toggleShowInserts,
  // Channel CRUD
  addChannel,
  addChannels,
  removeChannel,
  removeChannels,
  // Channel routing
  setChannelOutput,
  // Channel inserts
  addInsertToChannel,
  removeInsertFromChannel,
  reorderInsert,
  toggleInsertsBypassed,
  setInsertsBypassed,
  // Channel sends
  addSendToChannel,
  removeSendFromChannel,
  // Channel metering
  setMeterPreFader,
  setPeakHoldSeconds,
  // Channel UI
  toggleChannelAutomation,
  setChannelAutomation,
  // Runtime
  setCpuUsage,
  // Bulk / proyecto
  replaceChannels,
  loadMixerConfig,
  resetMixer,
} = mixerSlice.actions;

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: SELECTORES BÁSICOS
// ═══════════════════════════════════════════════════════════════

export const selectMixerSliceState = (state: { mixer: MixerSliceState }) =>
  state.mixer;

export const selectMixerGlobal = (state: { mixer: MixerSliceState }) =>
  state.mixer.global;

export const selectMixerChannels = (state: { mixer: MixerSliceState }) =>
  state.mixer.channels;

export const selectMixerCpuUsage = (state: { mixer: MixerSliceState }) =>
  state.mixer.cpuUsage;

export const selectMixerChannelByTrackId = (
  state: { mixer: MixerSliceState },
  trackId: string
) => state.mixer.channels[trackId] ?? null;

export default mixerSlice.reducer;