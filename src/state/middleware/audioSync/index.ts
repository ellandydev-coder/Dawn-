// src/state/middleware/audioSync/index.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 MIDDLEWARE audioSync — Bootstrap distribuido
// --------------------------------------------------------------
// Los handlers se auto-descubren via glob sobre `./handlers/*.ts`.
// Cada archivo exporta `registration: AudioSyncHandlerRegistration`
// y el bootstrap del registry los ejecuta uno a uno.
//
// ─── Para añadir un dominio nuevo ─────────────────────────────
//   1. Crear `handlers/miDominioHandlers.ts`
//   2. Implementar `registerMiDominioHandlers(startAppListening)`
//   3. Exportar `registration: AudioSyncHandlerRegistration`
//   4. Reiniciar — se descubre automáticamente
// ═══════════════════════════════════════════════════════════════

import { createListenerMiddleware } from '@reduxjs/toolkit';

import type { AppStartListening } from './types';
import { bootstrapAudioSyncHandlers } from './registry';

export const audioSyncMiddleware = createListenerMiddleware();

const startAppListening =
  audioSyncMiddleware.startListening as AppStartListening;

// Auto-descubre y registra todos los handlers de ./handlers/*.ts
bootstrapAudioSyncHandlers(startAppListening);

export {
  getMetronome,
  disposeMetronome,
  metronome,
} from '@audio/metronome/MetronomeSingleton';