// src/state/middleware/audioSyncMiddleware.ts
// ═══════════════════════════════════════════════════════════════
// 🔄 BRIDGE DE COMPATIBILIDAD
// --------------------------------------------------------------
// El middleware original fue refactorizado a src/state/middleware/audioSync/.
// Este archivo solo re-exporta la API pública para mantener los imports
// existentes funcionando:
//
//   import { audioSyncMiddleware } from '@state/middleware/audioSyncMiddleware';
//
// ⚠️ Para código NUEVO, prefiere el import directo:
//   import { audioSyncMiddleware } from '@state/middleware/audioSync';
// ═══════════════════════════════════════════════════════════════

export {
  audioSyncMiddleware,
  getMetronome,
  disposeMetronome,
  metronome,
} from './audioSync';