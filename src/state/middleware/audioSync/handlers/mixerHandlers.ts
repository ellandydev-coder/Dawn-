// src/state/middleware/audioSync/handlers/mixerHandlers.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 MIXER — Listeners de master, pan law, channel routing
// ═══════════════════════════════════════════════════════════════

import { audioEngine } from '@audio/engine/AudioEngine';
import {
  setMasterVolume,
  toggleMasterMute,
  setMasterMuted,
  toggleMasterLimiter,
  setMasterLimiterEnabled,
  setMasterHeadroom,
  setPanLaw,
  setChannelOutput,
  addChannel,
  removeChannel,
  replaceChannels,
} from '@state/slices/mixer/mixerSlice';

import { log } from '../config';
import { isAudioReady, safeEffect } from '../helpers';
import { applyChannelRouting } from '../graphSync';
import { propagatePanLawToGraph } from '../panLaw';
import type { AppStartListening } from '../types';

export function registerMixerHandlers(startAppListening: AppStartListening): void {

  // ─── Master (volume / mute) ──────────────────────────────────

  startAppListening({
    actionCreator: setMasterVolume,
    effect: safeEffect('setMasterVolume', (action) => {
      if (!isAudioReady()) return;
      audioEngine.setMasterVolume(action.payload);
    }),
  });

  startAppListening({
    actionCreator: toggleMasterMute,
    effect: safeEffect('toggleMasterMute', (_action, api) => {
      if (!isAudioReady()) return;
      audioEngine.setMuted(api.getState().mixer.global.masterMuted);
    }),
  });

  startAppListening({
    actionCreator: setMasterMuted,
    effect: safeEffect('setMasterMuted', (action) => {
      if (!isAudioReady()) return;
      audioEngine.setMuted(action.payload);
    }),
  });

  // ─── Master limiter (REAPER-style) ───────────────────────────

  startAppListening({
    actionCreator: toggleMasterLimiter,
    effect: safeEffect('toggleMasterLimiter', (_action, api) => {
      if (!isAudioReady()) return;
      audioEngine.setMasterLimiterEnabled(
        api.getState().mixer.global.masterLimiterEnabled
      );
    }),
  });

  startAppListening({
    actionCreator: setMasterLimiterEnabled,
    effect: safeEffect('setMasterLimiterEnabled', (action) => {
      if (!isAudioReady()) return;
      audioEngine.setMasterLimiterEnabled(action.payload);
    }),
  });

  startAppListening({
    actionCreator: setMasterHeadroom,
    effect: safeEffect('setMasterHeadroom', (action) => {
      if (!isAudioReady()) return;
      audioEngine.setMasterHeadroom(action.payload);
    }),
  });

  // ─── Pan law ─────────────────────────────────────────────────

  startAppListening({
    actionCreator: setPanLaw,
    effect: safeEffect('setPanLaw', (action) => {
      if (!isAudioReady()) return;
      // action.payload YA es PanLaw (payload tipado del action creator)
      propagatePanLawToGraph(action.payload);
      log(`Pan law → ${action.payload}`);
    }),
  });

  // ─── Channel routing ─────────────────────────────────────────

  startAppListening({
    actionCreator: setChannelOutput,
    effect: safeEffect('setChannelOutput', (action) => {
      if (!isAudioReady()) return;
      applyChannelRouting(action.payload.trackId, action.payload.outputBusId);
      log(
        `Channel routing: ${action.payload.trackId} → ${action.payload.outputBusId}`
      );
    }),
  });

  // ─── Channels lifecycle ──────────────────────────────────────

  startAppListening({
    actionCreator: addChannel,
    effect: safeEffect('addChannel', (action, api) => {
      if (!isAudioReady()) return;
      const trackId = action.payload;
      const channel = api.getState().mixer.channels[trackId];
      if (channel) {
        applyChannelRouting(trackId, channel.outputBusId);
      }
    }),
  });

  startAppListening({
    actionCreator: removeChannel,
    effect: safeEffect('removeChannel', (action) => {
      if (!isAudioReady()) return;
      // Al eliminar el canal, la track vuelve al master por defecto.
      const routingGraph = audioEngine.routingGraph;
      const trackId = action.payload;
      if (routingGraph.hasTrack(trackId)) {
        routingGraph.routeTrack(trackId, routingGraph.masterBus.id);
      }
    }),
  });

  startAppListening({
    actionCreator: replaceChannels,
    effect: safeEffect('replaceChannels', (action) => {
      if (!isAudioReady()) return;
      // Al reemplazar canales (carga de proyecto), re-aplicar routing
      for (const channel of action.payload) {
        applyChannelRouting(channel.trackId, channel.outputBusId);
      }
    }),
  });
}