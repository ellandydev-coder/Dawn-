// src/state/store/index.ts

import { configureStore } from '@reduxjs/toolkit';
import {
  useDispatch,
  useSelector,
  type TypedUseSelectorHook,
} from 'react-redux';

import transportReducer from '@state/slices/transport/transportSlice';
import tracksReducer from '@state/slices/tracks/tracksSlice';
import clipsReducer from '@state/slices/clips/clipsSlice';
import mixerReducer from '@state/slices/mixer/mixerSlice';
import projectReducer from '@state/slices/project/projectSlice';
import assetsReducer from '@state/slices/assets/assetsSlice';
import uiReducer from '@state/slices/ui/uiSlice';
import effectsReducer from '@state/slices/effects/effectsSlice';
import automationReducer from '@state/slices/automation/automationSlice';
import historyReducer from '@state/slices/history/historySlice';
import recordingReducer from '@state/slices/recording/recordingSlice';
import fxChainsReducer from '@state/slices/fxChains/fxChainsSlice';
import preferencesReducer from '@state/slices/preferences/preferencesSlice';

import { audioSyncMiddleware } from '@state/middleware/audioSyncMiddleware';
import { undoMiddleware } from '@state/middleware/undoMiddleware';

// ═══════════════════════════════════════════════════════════════
// 🏪 STORE
// ═══════════════════════════════════════════════════════════════

export const store = configureStore({
  reducer: {
    project: projectReducer,
    transport: transportReducer,
    tracks: tracksReducer,
    clips: clipsReducer,
    mixer: mixerReducer,
    assets: assetsReducer,
    ui: uiReducer,
    effects: effectsReducer,
    automation: automationReducer,
    history: historyReducer,
    recording: recordingReducer,
    fxChains: fxChainsReducer,
    preferences: preferencesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .prepend(audioSyncMiddleware.middleware)
      .prepend(undoMiddleware.middleware),
});

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
export type AppStore = typeof store;

// ═══════════════════════════════════════════════════════════════
// 🪝 HOOKS TIPADOS
// ═══════════════════════════════════════════════════════════════

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

// ═══════════════════════════════════════════════════════════════
// 🛠️ DEVTOOLS (solo en desarrollo)
// ═══════════════════════════════════════════════════════════════

declare global {
  interface Window {
    /** Store expuesto para debugging (solo dev) */
    store?: AppStore;
  }
}

if (import.meta.env.DEV && typeof window !== 'undefined') {
  window.store = store;
}