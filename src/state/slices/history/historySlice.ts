// src/state/slices/history/historySlice.ts

import { createSlice, createAction, type PayloadAction } from '@reduxjs/toolkit';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/**
 * Snapshot mínimo de un gesto.
 *
 * En vez de guardar todo el state tree (costoso),
 * guardamos solo el "parche" del gesto:
 *   - qué slice se afectó
 *   - qué entidad (trackId, clipId, etc.)
 *   - qué campo cambió
 *   - valor antes y después
 *
 * Esto es O(1) en memoria por gesto.
 */
export interface GesturePatch {
  /** Slice afectado */
  slice: string;
  /** ID de la entidad (ej: trackId) */
  entityId: string;
  /** Campo modificado (ej: 'volume', 'pan', 'name') */
  field: string;
  /** Valor antes del gesto */
  before: unknown;
  /** Valor después del gesto */
  after: unknown;
}

export interface GestureEntry {
  /** ID único del gesto */
  id: string;
  /** Descripción legible (para UI de historial) */
  label: string;
  /** Timestamp */
  timestamp: number;
  /** Parches que componen el gesto */
  patches: GesturePatch[];
}

export interface HistoryState {
  /** Pila de gestos pasados (el último es el más reciente) */
  past: GestureEntry[];
  /** Pila de gestos deshechos (para redo) */
  future: GestureEntry[];
  /** Tamaño máximo del historial */
  maxSize: number;
  /**
   * Snapshot temporal del valor "antes" de un gesto en curso.
   * Se llena en el primer onChange y se consume en el commit.
   * Record<`${slice}/${entityId}/${field}`, valorAntes>
   */
  pendingSnapshots: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const DEFAULT_MAX_SIZE = 100;

const initialState: HistoryState = {
  past: [],
  future: [],
  maxSize: DEFAULT_MAX_SIZE,
  pendingSnapshots: {},
};

// ═══════════════════════════════════════════════════════════════
// 🎯 ACTIONS GLOBALES (usadas por el middleware)
// ═══════════════════════════════════════════════════════════════

/**
 * Captura el valor "antes" al inicio de un gesto.
 * El middleware la dispara automáticamente en el primer
 * onChange de un campo monitorizado.
 */
export const captureGestureStart = createAction<{
  slice: string;
  entityId: string;
  field: string;
  value: unknown;
}>('history/captureGestureStart');

/**
 * Confirma el final de un gesto.
 * El componente (o hook) la dispara al soltar el control.
 */
export const commitGesture = createAction<{
  slice: string;
  entityId: string;
  field: string;
  value: unknown;
  label: string;
}>('history/commitGesture');

/** Deshace el último gesto */
export const undo = createAction('history/undo');

/** Rehace el último gesto deshecho */
export const redo = createAction('history/redo');

/** Limpia todo el historial */
export const clearHistory = createAction('history/clearHistory');

// ═══════════════════════════════════════════════════════════════
// 🎯 SLICE
// ═══════════════════════════════════════════════════════════════

const historySlice = createSlice({
  name: 'history',
  initialState,
  reducers: {
    setMaxHistorySize(state, action: PayloadAction<number>) {
      state.maxSize = Math.max(1, action.payload);
      // Truncar si excede
      if (state.past.length > state.maxSize) {
        state.past = state.past.slice(-state.maxSize);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(captureGestureStart, (state, action) => {
        const { slice, entityId, field, value } = action.payload;
        const key = `${slice}/${entityId}/${field}`;
        // Solo capturar si no hay snapshot pendiente para esta combinación
        if (!(key in state.pendingSnapshots)) {
          state.pendingSnapshots[key] = value;
        }
      })

      .addCase(commitGesture, (state, action) => {
        const { slice, entityId, field, value: after, label } = action.payload;
        const key = `${slice}/${entityId}/${field}`;
        const before = state.pendingSnapshots[key];

        // Limpiar snapshot pendiente
        delete state.pendingSnapshots[key];

        // Si no hubo cambio real, no registrar
        if (before === undefined || before === after) return;

        const entry: GestureEntry = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          label,
          timestamp: Date.now(),
          patches: [{ slice, entityId, field, before, after }],
        };

        state.past.push(entry);

        // Truncar historial si excede el máximo
        if (state.past.length > state.maxSize) {
          state.past = state.past.slice(-state.maxSize);
        }

        // Cualquier commit nuevo invalida el redo
        state.future = [];
      })

      .addCase(undo, (state) => {
        const entry = state.past.pop();
        if (!entry) return;
        state.future.push(entry);
      })

      .addCase(redo, (state) => {
        const entry = state.future.pop();
        if (!entry) return;
        state.past.push(entry);
      })

      .addCase(clearHistory, (state) => {
        state.past = [];
        state.future = [];
        state.pendingSnapshots = {};
      });
  },
});

// ═══════════════════════════════════════════════════════════════
// 🎯 EXPORTS
// ═══════════════════════════════════════════════════════════════

export const { setMaxHistorySize } = historySlice.actions;
export default historySlice.reducer;