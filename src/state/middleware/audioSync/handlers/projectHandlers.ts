// src/state/middleware/audioSync/handlers/projectHandlers.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 CARGA DE PROYECTO — Listener de loadProject
// --------------------------------------------------------------
// Sincroniza la configuración global al cargar un proyecto.
// La recreación de tracks/channels se resuelve por replaceTracks/
// replaceChannels (ver tracks/mixerHandlers).
// ═══════════════════════════════════════════════════════════════

import { audioEngine } from '@audio/engine/AudioEngine';
import { loadProject } from '@state/slices/project/projectSlice';

import { log } from '../config';
import { isAudioReady, safeEffect, ensurePanLaw } from '../helpers';
import { propagatePanLawToGraph } from '../panLaw';
import { metronome } from '@audio/metronome/MetronomeSingleton';
import type { AppStartListening } from '../types';

export function registerProjectHandlers(startAppListening: AppStartListening): void {

  startAppListening({
    actionCreator: loadProject,
    effect: safeEffect('loadProject', (_action, api) => {
      if (!isAudioReady()) return;

      const state = api.getState();
      const mixer = state.mixer.global;

      // Master
      audioEngine.setMasterVolume(mixer.masterVolume);
      audioEngine.setMuted(mixer.masterMuted);
      audioEngine.setMasterLimiterEnabled(mixer.masterLimiterEnabled);
      audioEngine.setMasterHeadroom(mixer.masterHeadroom);

      // Pan law — validar en runtime porque el schema Zod lo tipa como string
      const panLaw = ensurePanLaw(mixer.panLaw);
      propagatePanLawToGraph(panLaw);

      // Metrónomo — actualizar BPM/TS si ya existe
      const metro = metronome.peek();
      if (metro) {
        metro.setBpm(state.project.current.bpm);
        metro.setTimeSignature(
          state.project.current.timeSignature.numerator,
          state.project.current.timeSignature.denominator
        );
      }

      log(`Proyecto cargado: "${state.project.current.name}"`);
    }),
  });
}