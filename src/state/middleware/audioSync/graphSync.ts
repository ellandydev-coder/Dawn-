// src/state/middleware/audioSync/graphSync.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 graphSync — Re-exports de compatibilidad
// --------------------------------------------------------------
// La lógica fue dividida en módulos dedicados:
//   muteSync.ts       ← mute/solo REAPER-style
//   trackSync.ts      ← sync de propiedades de track
//   channelRouting.ts ← routing de canales
// ═══════════════════════════════════════════════════════════════

export {
  applyMuteSoloLogic,
  applyMuteSoloLogicToAllTracks,
} from './muteSync';

export {
  syncTrackNodeFromState,
  removeTrackNode,
} from './trackSync';

export {
  applyChannelRouting,
} from './channelRouting';