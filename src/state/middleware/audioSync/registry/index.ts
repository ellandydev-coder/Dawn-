// src/state/middleware/audioSync/registry/index.ts

// ═══════════════════════════════════════════════════════════════
// 📤 BARREL: exports públicos del registry de audio sync handlers
// ═══════════════════════════════════════════════════════════════

export type {
  AudioSyncHandlerRegistration,
  AudioSyncHandlerRegisterFn,
} from './audioSyncHandlers.types';

export { audioSyncHandlersRegistry } from './audioSyncHandlersRegistry';

export { bootstrapAudioSyncHandlers } from './bootstrap';