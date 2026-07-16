// src/state/slices/fxChains/fxChainsSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { nanoid } from 'nanoid';
import type { FxChain } from '@domain/models/FxChain';
import type { FxPluginInstance } from '@domain/models/FxPluginInstance';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface FxChainsState {
  /** Chains indexadas por ownerId (trackId o "master") */
  byOwnerId: Record<string, FxChain>;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

const createInitialState = (): FxChainsState => ({
  byOwnerId: {},
});

/**
 * Devuelve la chain de un owner, creándola si no existe.
 * Mutación segura porque Redux Toolkit usa Immer.
 */
function ensureChain(state: FxChainsState, ownerId: string): FxChain {
  let chain = state.byOwnerId[ownerId];
  if (!chain) {
    chain = {
      id: nanoid(),
      ownerId,
      plugins: [],
    };
    state.byOwnerId[ownerId] = chain;
  }
  return chain;
}

function createInstance(
  pluginId: string,
  displayName: string
): FxPluginInstance {
  return {
    id: nanoid(),
    pluginId,
    displayName,
    enabled: true,
    params: {},
    presetId: null,
    addedAt: Date.now(),
  };
}

/**
 * Reordena un array in-place moviendo el item de fromIndex a toIndex.
 * Ambos índices se acotan al rango válido.
 */
function moveArrayItem<T>(arr: T[], fromIndex: number, toIndex: number): void {
  if (fromIndex < 0 || fromIndex >= arr.length) return;
  const clampedTo = Math.max(0, Math.min(arr.length - 1, toIndex));
  if (fromIndex === clampedTo) return;

  const [item] = arr.splice(fromIndex, 1);
  arr.splice(clampedTo, 0, item);
}

// ═══════════════════════════════════════════════════════════════
// 🏪 SLICE
// ═══════════════════════════════════════════════════════════════

const initialState: FxChainsState = createInitialState();

const fxChainsSlice = createSlice({
  name: 'fxChains',
  initialState,
  reducers: {
    // ─── Añadir plugin ─────────────────────────────────────

    /**
     * Añade un plugin al final de la chain del owner.
     * Si la chain no existe, se crea automáticamente.
     */
    addPluginToChain(
      state,
      action: PayloadAction<{
        ownerId: string;
        pluginId: string;
        displayName: string;
      }>
    ) {
      const { ownerId, pluginId, displayName } = action.payload;
      const chain = ensureChain(state, ownerId);
      chain.plugins.push(createInstance(pluginId, displayName));
    },

    /**
     * Inserta un plugin en una posición específica de la chain.
     * Útil para drag & drop desde el browser a un slot concreto.
     */
    insertPluginInChain(
      state,
      action: PayloadAction<{
        ownerId: string;
        pluginId: string;
        displayName: string;
        atIndex: number;
      }>
    ) {
      const { ownerId, pluginId, displayName, atIndex } = action.payload;
      const chain = ensureChain(state, ownerId);
      const clamped = Math.max(0, Math.min(chain.plugins.length, atIndex));
      chain.plugins.splice(clamped, 0, createInstance(pluginId, displayName));
    },

    // ─── Eliminar plugin ───────────────────────────────────

    removePluginFromChain(
      state,
      action: PayloadAction<{ ownerId: string; instanceId: string }>
    ) {
      const { ownerId, instanceId } = action.payload;
      const chain = state.byOwnerId[ownerId];
      if (!chain) return;
      chain.plugins = chain.plugins.filter((p) => p.id !== instanceId);
    },

    // ─── Reordenar ─────────────────────────────────────────

    reorderPluginInChain(
      state,
      action: PayloadAction<{
        ownerId: string;
        fromIndex: number;
        toIndex: number;
      }>
    ) {
      const { ownerId, fromIndex, toIndex } = action.payload;
      const chain = state.byOwnerId[ownerId];
      if (!chain) return;
      moveArrayItem(chain.plugins, fromIndex, toIndex);
    },

    // ─── Toggle enable por plugin ──────────────────────────

    setPluginEnabled(
      state,
      action: PayloadAction<{
        ownerId: string;
        instanceId: string;
        enabled: boolean;
      }>
    ) {
      const { ownerId, instanceId, enabled } = action.payload;
      const chain = state.byOwnerId[ownerId];
      if (!chain) return;
      const plugin = chain.plugins.find((p) => p.id === instanceId);
      if (!plugin) return;
      plugin.enabled = enabled;
    },

    togglePluginEnabled(
      state,
      action: PayloadAction<{ ownerId: string; instanceId: string }>
    ) {
      const { ownerId, instanceId } = action.payload;
      const chain = state.byOwnerId[ownerId];
      if (!chain) return;
      const plugin = chain.plugins.find((p) => p.id === instanceId);
      if (!plugin) return;
      plugin.enabled = !plugin.enabled;
    },

    // ─── Rename display ────────────────────────────────────

    renamePluginInstance(
      state,
      action: PayloadAction<{
        ownerId: string;
        instanceId: string;
        displayName: string;
      }>
    ) {
      const { ownerId, instanceId, displayName } = action.payload;
      const chain = state.byOwnerId[ownerId];
      if (!chain) return;
      const plugin = chain.plugins.find((p) => p.id === instanceId);
      if (!plugin) return;
      const trimmed = displayName.trim();
      if (trimmed.length === 0) return;
      plugin.displayName = trimmed;
    },

    // ─── Params ────────────────────────────────────────────

    setPluginParam(
      state,
      action: PayloadAction<{
        ownerId: string;
        instanceId: string;
        paramId: string;
        value: number;
      }>
    ) {
      const { ownerId, instanceId, paramId, value } = action.payload;
      const chain = state.byOwnerId[ownerId];
      if (!chain) return;
      const plugin = chain.plugins.find((p) => p.id === instanceId);
      if (!plugin) return;
      plugin.params[paramId] = value;
    },

    // ─── Reset / eliminar chain ────────────────────────────

    /**
     * Elimina toda la chain de un owner.
     * Se llama cuando se borra una track para limpiar su cadena.
     */
    removeChain(state, action: PayloadAction<string>) {
      delete state.byOwnerId[action.payload];
    },

    /** Limpia todos los plugins de una chain (mantiene la chain vacía) */
    clearChain(state, action: PayloadAction<string>) {
      const chain = state.byOwnerId[action.payload];
      if (!chain) return;
      chain.plugins = [];
    },

    // ─── Reset ─────────────────────────────────────────────

    resetFxChains() {
      return createInitialState();
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: ACCIONES
// ═══════════════════════════════════════════════════════════════

export const {
  addPluginToChain,
  insertPluginInChain,
  removePluginFromChain,
  reorderPluginInChain,
  setPluginEnabled,
  togglePluginEnabled,
  renamePluginInstance,
  setPluginParam,
  removeChain,
  clearChain,
  resetFxChains,
} = fxChainsSlice.actions;

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: SELECTORES BÁSICOS
// ═══════════════════════════════════════════════════════════════

type FxChainsRootState = { fxChains: FxChainsState };

export const selectFxChainsState = (state: FxChainsRootState) =>
  state.fxChains;

/** Devuelve la chain de un owner, o null si no existe */
export const selectFxChainByOwnerId = (
  state: FxChainsRootState,
  ownerId: string
): FxChain | null => state.fxChains.byOwnerId[ownerId] ?? null;

/** Devuelve el número de plugins en la chain de un owner (0 si no hay chain) */
export const selectFxChainSize = (
  state: FxChainsRootState,
  ownerId: string
): number => state.fxChains.byOwnerId[ownerId]?.plugins.length ?? 0;

export default fxChainsSlice.reducer;