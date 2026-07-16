// src/state/middleware/audioSync/types.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 Tipos compartidos del middleware audioSync
// ═══════════════════════════════════════════════════════════════

import type { TypedStartListening } from '@reduxjs/toolkit';
import type { RootState, AppDispatch } from '@state/store';

export type AppStartListening = TypedStartListening<RootState, AppDispatch>;

export type AudioSyncApi = {
  getState: () => RootState;
  getOriginalState: () => RootState;
};