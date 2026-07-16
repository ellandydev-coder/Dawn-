// src/state/middleware/audioSync/handlers/tracksHandlers.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 TRACKS — Listeners de lifecycle, parámetros y mute/solo
// ═══════════════════════════════════════════════════════════════

import {
  addTrack,
  duplicateTrack,
  removeTrack,
  replaceTracks,
  resetTracks,
  setTrackVolume,
  setTrackPan,
  toggleMute,
  toggleSolo,
  clearAllSolo,
  soloExclusive,
} from '@state/slices/tracks/tracksSlice';

import { log } from '../config';
import { isAudioReady, safeEffect } from '../helpers';
import {
  syncTrackNodeFromState,
  removeTrackNode,
  applyMuteSoloLogic,
  applyMuteSoloLogicToAllTracks,
} from '../graphSync';
import type { AppStartListening } from '../types';

/**
 * Registra todos los listeners de tracks en el middleware.
 * @param startAppListening — startListening tipado del middleware
 */
export function registerTracksHandlers(startAppListening: AppStartListening): void {

  // ─── Lifecycle ────────────────────────────────────────────────

  startAppListening({
    actionCreator: addTrack,
    effect: safeEffect('addTrack', (action, api) => {
      if (!isAudioReady()) return;
      syncTrackNodeFromState(action.payload.id, api.getState(), true);
      log(`Track creada: ${action.payload.id}`);
    }),
  });

  startAppListening({
    actionCreator: duplicateTrack,
    effect: safeEffect('duplicateTrack', (action, api) => {
      if (!isAudioReady()) return;
      syncTrackNodeFromState(action.payload.newTrack.id, api.getState(), true);
      log(`Track duplicada: ${action.payload.newTrack.id}`);
    }),
  });

  startAppListening({
    actionCreator: removeTrack,
    effect: safeEffect('removeTrack', (action, api) => {
      if (!isAudioReady()) return;
      removeTrackNode(action.payload);
      // Re-evaluar mute/solo: si la track eliminada era la única soloed,
      // el resto queda mal hasta re-aplicar la lógica.
      applyMuteSoloLogicToAllTracks(api.getState());
      log(`Track eliminada: ${action.payload}`);
    }),
  });

  startAppListening({
    actionCreator: replaceTracks,
    effect: safeEffect('replaceTracks', (_action, api) => {
      if (!isAudioReady()) return;

      const prevState = api.getOriginalState();
      const nextState = api.getState();
      const nextIds = new Set(nextState.tracks.allIds);

      // Remover tracks que ya no existen
      for (const trackId of prevState.tracks.allIds) {
        if (!nextIds.has(trackId)) {
          removeTrackNode(trackId);
        }
      }

      // Crear / sincronizar tracks actuales
      for (const trackId of nextState.tracks.allIds) {
        syncTrackNodeFromState(trackId, nextState, true);
      }

      applyMuteSoloLogicToAllTracks(nextState);
      log(`Tracks reemplazadas: ${nextState.tracks.allIds.length}`);
    }),
  });

  startAppListening({
    actionCreator: resetTracks,
    effect: safeEffect('resetTracks', (_action, api) => {
      if (!isAudioReady()) return;
      const prevState = api.getOriginalState();
      for (const trackId of prevState.tracks.allIds) {
        removeTrackNode(trackId);
      }
      log('Tracks reseteadas');
    }),
  });

  // ─── Parámetros continuos ────────────────────────────────────

  startAppListening({
    actionCreator: setTrackVolume,
    effect: safeEffect('setTrackVolume', (action, api) => {
      if (!isAudioReady()) return;
      // Auto-heal: crea el nodo si no existe (defensivo)
      syncTrackNodeFromState(action.payload.id, api.getState(), true);
    }),
  });

  startAppListening({
    actionCreator: setTrackPan,
    effect: safeEffect('setTrackPan', (action, api) => {
      if (!isAudioReady()) return;
      syncTrackNodeFromState(action.payload.id, api.getState(), true);
    }),
  });

  // ─── Mute / Solo (REAPER-style) ──────────────────────────────

  startAppListening({
    actionCreator: toggleMute,
    effect: safeEffect('toggleMute', (action, api) => {
      applyMuteSoloLogic(action.payload, api.getState());
    }),
  });

  startAppListening({
    actionCreator: toggleSolo,
    effect: safeEffect('toggleSolo', (_action, api) => {
      applyMuteSoloLogicToAllTracks(api.getState());
    }),
  });

  startAppListening({
    actionCreator: soloExclusive,
    effect: safeEffect('soloExclusive', (_action, api) => {
      applyMuteSoloLogicToAllTracks(api.getState());
    }),
  });

  startAppListening({
    actionCreator: clearAllSolo,
    effect: safeEffect('clearAllSolo', (_action, api) => {
      applyMuteSoloLogicToAllTracks(api.getState());
    }),
  });
}


// ═══════════════════════════════════════════════════════════════
// 📤 REGISTRATION
// ═══════════════════════════════════════════════════════════════

import type { AudioSyncHandlerRegistration } from '../registry';

export const registration: AudioSyncHandlerRegistration = {
  id: 'tracks',
  register: registerTracksHandlers,
};