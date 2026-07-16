// src/state/middleware/audioSync/handlers/transportHandlers.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 TRANSPORT ↔ METRÓNOMO — Listeners de transport
// ═══════════════════════════════════════════════════════════════

import {
  play,
  pause,
  stop,
  stopAndRewind,
  togglePlayPause,
  toggleRecord,
  setRecording,
} from '@state/slices/transport/transportSlice';
import type { RootState } from '@state/store';
import { metronome } from '@audio/metronome/MetronomeSingleton';

import { safeEffect } from '../helpers';
import type { AppStartListening } from '../types';

function syncMetronomeWithTransport(
  state: RootState,
  shouldPlay: boolean
): void {
  if (!state.transport.metronomeEnabled) return;

  // Durante el count-in, el metrónomo lo maneja recordingHandlers vía startPreCount.
  // No pisamos ese flow desde aquí.
  if (state.transport.isCountingIn) return;

  const metro = metronome.get();
  if (!metro) return;

  if (shouldPlay) {
    metro.setBpm(state.project.current.bpm);
    const { numerator, denominator } = state.project.current.timeSignature;
    metro.setTimeSignature(numerator, denominator);
    metro.start();
  } else {
    metro.stop();
  }
}

export function registerTransportHandlers(startAppListening: AppStartListening): void {
  startAppListening({
    actionCreator: play,
    effect: safeEffect('play', (_action, api) => {
      syncMetronomeWithTransport(api.getState(), true);
    }),
  });

  startAppListening({
    actionCreator: pause,
    effect: safeEffect('pause', (_action, api) => {
      syncMetronomeWithTransport(api.getState(), false);
    }),
  });

  startAppListening({
    actionCreator: stop,
    effect: safeEffect('stop', (_action, api) => {
      syncMetronomeWithTransport(api.getState(), false);
    }),
  });

  startAppListening({
    actionCreator: stopAndRewind,
    effect: safeEffect('stopAndRewind', (_action, api) => {
      syncMetronomeWithTransport(api.getState(), false);
    }),
  });

  startAppListening({
    actionCreator: togglePlayPause,
    effect: safeEffect('togglePlayPause', (_action, api) => {
      const state = api.getState();
      syncMetronomeWithTransport(state, state.transport.isPlaying);
    }),
  });

  startAppListening({
    actionCreator: toggleRecord,
    effect: safeEffect('toggleRecord', (_action, api) => {
      const state = api.getState();
      // Con la nueva lógica, toggleRecord NO cambia isPlaying directamente.
      // El metrónomo lo enciende: (a) recordingHandlers (count-in) o (b) el play/finishCountIn siguiente.
      // Si isRecording=false y estamos parando, aseguramos que se detiene.
      if (!state.transport.isRecording) {
        syncMetronomeWithTransport(state, false);
      }
    }),
  });

  startAppListening({
    actionCreator: setRecording,
    effect: safeEffect('setRecording', (_action, api) => {
      const state = api.getState();
      if (!state.transport.isRecording) {
        syncMetronomeWithTransport(state, false);
      }
    }),
  });
}


// ═══════════════════════════════════════════════════════════════
// 📤 REGISTRATION
// ═══════════════════════════════════════════════════════════════

import type { AudioSyncHandlerRegistration } from '../registry';

export const registration: AudioSyncHandlerRegistration = {
  id: 'transport',
  register: registerTransportHandlers,
};