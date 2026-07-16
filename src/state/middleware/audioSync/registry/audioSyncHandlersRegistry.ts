// src/state/middleware/audioSync/registry/audioSyncHandlersRegistry.ts

import { createRegistry } from '@shared/registry/createRegistry';
import type { AudioSyncHandlerRegistration } from './audioSyncHandlers.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 REGISTRY DE HANDLERS DE AUDIO SYNC
// ═══════════════════════════════════════════════════════════════

/**
 * Registry principal de grupos de handlers del middleware audioSync.
 *
 * Se auto-pobla via Vite glob eager sobre `../handlers/*.ts` en el
 * bootstrap. Cada archivo debe exportar `registration: AudioSyncHandlerRegistration`.
 *
 * Validaciones al registrar:
 *   • id único (default de createRegistry)
 *   • register es una función
 *
 * Este registry solo contiene METADATOS de los grupos.
 * El registro real de listeners se ejecuta en el bootstrap
 * llamando a `entry.register(startAppListening)`.
 */
export const audioSyncHandlersRegistry = createRegistry<AudioSyncHandlerRegistration>({
  name: 'audioSync.handlers',

  validate(entry) {
    if (typeof entry.register !== 'function') {
      return `handler group "${entry.id}" must expose a register(startAppListening) function`;
    }
    return null;
  },
});