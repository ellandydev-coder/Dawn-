// src/state/middleware/audioSync/handlers/metronomeHandlers.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 METRÓNOMO — Listeners de configuración
// ═══════════════════════════════════════════════════════════════

import {
  toggleMetronome,
  setMetronomeEnabled,
} from '@state/slices/transport/transportSlice';
import {
  setBpm,
  setTimeSignature,
} from '@state/slices/project/projectSlice';

import { log } from '../config';
import { safeEffect } from '../helpers';
import { metronome } from '@audio/metronome/MetronomeSingleton';
import type { AppStartListening } from '../types';

export function registerMetronomeHandlers(startAppListening: AppStartListening): void {

  startAppListening({
    actionCreator: toggleMetronome,
    effect: safeEffect('toggleMetronome', (_action, api) => {
      const state = api.getState();
      const metro = metronome.get();
      if (!metro) return;

      metro.setBpm(state.project.current.bpm);
      const { numerator, denominator } = state.project.current.timeSignature;
      metro.setTimeSignature(numerator, denominator);

      // Solo iniciar si el transport está reproduciendo.
      // Si el metrónomo se enciende sin transport activo, queda armado
      // pero silencioso hasta que empiece la reproducción.
      if (state.transport.metronomeEnabled && state.transport.isPlaying) {
        metro.start();
        log('Metronome ON (playing)');
      } else if (!state.transport.metronomeEnabled) {
        metro.stop();
        log('Metronome OFF');
      } else {
        log('Metronome armed (esperando play)');
      }
    }),
  });

  startAppListening({
    actionCreator: setMetronomeEnabled,
    effect: safeEffect('setMetronomeEnabled', (action, api) => {
      const state = api.getState();
      const metro = metronome.get();
      if (!metro) return;

      if (action.payload && state.transport.isPlaying) {
        metro.setBpm(state.project.current.bpm);
        const { numerator, denominator } = state.project.current.timeSignature;
        metro.setTimeSignature(numerator, denominator);
        metro.start();
      } else if (!action.payload) {
        metro.stop();
      }
    }),
  });

  startAppListening({
    actionCreator: setBpm,
    effect: safeEffect('setBpm', (action) => {
      // peek(): NO crear el metrónomo si no existe todavía.
      // Si el usuario cambia BPM antes de encender el metrónomo,
      // el valor se aplicará al momento de start().
      metronome.peek()?.setBpm(action.payload);
    }),
  });

  startAppListening({
    actionCreator: setTimeSignature,
    effect: safeEffect('setTimeSignature', (action) => {
      metronome.peek()?.setTimeSignature(
        action.payload.numerator,
        action.payload.denominator
      );
    }),
  });
}