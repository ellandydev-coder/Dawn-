// src/state/middleware/undoMiddleware.ts

import {
  createListenerMiddleware,
  isAnyOf,
  type TypedStartListening,
} from '@reduxjs/toolkit';
import type { RootState, AppDispatch } from '@state/store';

import {
  setTrackVolume,
  setTrackPan,
} from '@state/slices/tracks/tracksSlice';

import {
  captureGestureStart,
  commitGesture,
  undo,
  redo,
  type GestureEntry,
} from '@state/slices/history/historySlice';

// ═══════════════════════════════════════════════════════════════
// 🎯 MIDDLEWARE + TIPADO
// ═══════════════════════════════════════════════════════════════

export const undoMiddleware = createListenerMiddleware();

type AppStartListening = TypedStartListening<RootState, AppDispatch>;

const startListening =
  undoMiddleware.startListening as AppStartListening;

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS DE ACCIONES MONITORIZADAS
// ═══════════════════════════════════════════════════════════════

/**
 * Union type de todas las acciones que capturamos.
 * Extraído directamente de los action creators para que
 * TypeScript infiera el payload correcto.
 */
type MonitoredActionType =
  | ReturnType<typeof setTrackVolume>
  | ReturnType<typeof setTrackPan>;

// ═══════════════════════════════════════════════════════════════
// 🎯 LISTENER 1: Captura automática del "antes"
// ═══════════════════════════════════════════════════════════════

interface MonitoredAction {
  slice: string;
  field: string;
  getEntityId: (payload: unknown) => string;
  getCurrentValue: (state: RootState, entityId: string) => unknown;
  buildLabel: (state: RootState, entityId: string) => string;
}

const MONITORED_ACTIONS: Record<string, MonitoredAction> = {
  [setTrackVolume.type]: {
    slice: 'tracks',
    field: 'volume',
    getEntityId: (p) => (p as { id: string }).id,
    getCurrentValue: (s, id) => s.tracks.byId[id]?.volume,
    buildLabel: (s, id) => {
      const name = s.tracks.byId[id]?.name ?? 'Track';
      return `${name}: cambiar volumen`;
    },
  },
  [setTrackPan.type]: {
    slice: 'tracks',
    field: 'pan',
    getEntityId: (p) => (p as { id: string }).id,
    getCurrentValue: (s, id) => s.tracks.byId[id]?.pan,
    buildLabel: (s, id) => {
      const name = s.tracks.byId[id]?.name ?? 'Track';
      return `${name}: cambiar pan`;
    },
  },
};

startListening({
  matcher: isAnyOf(setTrackVolume, setTrackPan),
  effect: (action, listenerApi) => {
    const typedAction = action as MonitoredActionType;

    const config = MONITORED_ACTIONS[typedAction.type];
    if (!config) return;

    const state = listenerApi.getOriginalState();
    const entityId = config.getEntityId(typedAction.payload);
    const key = `${config.slice}/${entityId}/${config.field}`;

    // Solo capturar si no hay snapshot pendiente
    if (key in state.history.pendingSnapshots) return;

    const currentValue = config.getCurrentValue(state, entityId);

    listenerApi.dispatch(
      captureGestureStart({
        slice: config.slice,
        entityId,
        field: config.field,
        value: currentValue,
      })
    );
  },
});

// ═══════════════════════════════════════════════════════════════
// 🎯 LISTENER 2 y 3: Undo / Redo
// ═══════════════════════════════════════════════════════════════

type ValueApplier = (
  dispatch: AppDispatch,
  entityId: string,
  value: unknown
) => void;

const VALUE_APPLIERS: Record<string, ValueApplier> = {
  'tracks/volume': (dispatch, entityId, value) => {
    dispatch(setTrackVolume({ id: entityId, volume: value as number }));
  },
  'tracks/pan': (dispatch, entityId, value) => {
    dispatch(setTrackPan({ id: entityId, pan: value as number }));
  },
};

function applyPatches(
  dispatch: AppDispatch,
  entry: GestureEntry,
  direction: 'undo' | 'redo'
): void {
  for (const patch of entry.patches) {
    const key = `${patch.slice}/${patch.field}`;
    const applier = VALUE_APPLIERS[key];
    if (!applier) continue;

    const value = direction === 'undo' ? patch.before : patch.after;
    applier(dispatch, patch.entityId, value);
  }
}

startListening({
  actionCreator: undo,
  effect: (_action, listenerApi) => {
    const state = listenerApi.getState();
    // Después del reducer, la entrada ya está en future
    const entry = state.history.future[state.history.future.length - 1];
    if (!entry) return;

    applyPatches(listenerApi.dispatch, entry, 'undo');
  },
});

startListening({
  actionCreator: redo,
  effect: (_action, listenerApi) => {
    const state = listenerApi.getState();
    // Después del reducer, la entrada ya volvió a past
    const entry = state.history.past[state.history.past.length - 1];
    if (!entry) return;

    applyPatches(listenerApi.dispatch, entry, 'redo');
  },
});

// ═══════════════════════════════════════════════════════════════
// 🎯 EXPORT
// ═══════════════════════════════════════════════════════════════

export { commitGesture };