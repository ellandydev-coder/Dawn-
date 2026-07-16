// src/state/slices/assets/assetsSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Asset } from '@domain/models/Asset';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const FALLBACK_ASSET_NAME = 'Untitled Asset';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface AssetsState {
  byId: Record<string, Asset>;
  allIds: string[];
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

function hasAsset(state: AssetsState, id: string): boolean {
  return id in state.byId;
}

function normalizeAssetName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : FALLBACK_ASSET_NAME;
}

const createInitialState = (): AssetsState => ({
  byId: {},
  allIds: [],
});

// ═══════════════════════════════════════════════════════════════
// 🏪 SLICE
// ═══════════════════════════════════════════════════════════════

const initialState: AssetsState = createInitialState();

const assetsSlice = createSlice({
  name: 'assets',
  initialState,
  reducers: {
    // ─── CRUD ────────────────────────────────────────────────

    /**
     * Registra un asset (metadata serializable).
     * El AudioBuffer real vive en AssetRegistry (fuera de Redux).
     * Idempotente: si el ID ya existe, actualiza los metadatos.
     */
    addAsset(state, action: PayloadAction<Asset>) {
      const asset = action.payload;

      state.byId[asset.id] = asset;

      if (!state.allIds.includes(asset.id)) {
        state.allIds.push(asset.id);
      }
    },

    /**
     * Elimina un asset por ID.
     * El llamador es responsable de limpiar AssetRegistry.remove(id)
     * y de desvincular cualquier clip que lo referencie.
     */
    removeAsset(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!hasAsset(state, id)) return;

      delete state.byId[id];
      state.allIds = state.allIds.filter((assetId) => assetId !== id);
    },

    /**
     * Elimina múltiples assets de una vez.
     * Más eficiente que N llamadas a removeAsset.
     */
    removeAssets(state, action: PayloadAction<string[]>) {
      const toRemove = new Set(action.payload);
      if (toRemove.size === 0) return;

      for (const id of toRemove) {
        delete state.byId[id];
      }

      state.allIds = state.allIds.filter((id) => !toRemove.has(id));
    },

    renameAsset(
      state,
      action: PayloadAction<{ id: string; name: string }>
    ) {
      const asset = state.byId[action.payload.id];
      if (!asset) return;

      const name = normalizeAssetName(action.payload.name);
      if (asset.name === name) return;

      asset.name = name;
    },

    // ─── BULK / PROYECTO ────────────────────────────────────

    /**
     * Carga completa de assets (abrir proyecto).
     * Reemplaza todos los assets existentes.
     * Nota: los AudioBuffers deben cargarse por separado en AssetLoader
     * y registrarse en AssetRegistry.
     */
    replaceAssets(state, action: PayloadAction<Asset[]>) {
      state.byId = {};
      state.allIds = [];

      for (const asset of action.payload) {
        if (state.byId[asset.id]) continue;

        state.byId[asset.id] = asset;
        state.allIds.push(asset.id);
      }
    },

    resetAssets() {
      return createInitialState();
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: ACCIONES
// ═══════════════════════════════════════════════════════════════

export const {
  addAsset,
  removeAsset,
  removeAssets,
  renameAsset,
  replaceAssets,
  resetAssets,
} = assetsSlice.actions;

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: SELECTORES BÁSICOS
// ═══════════════════════════════════════════════════════════════

export const selectAssetsState = (state: { assets: AssetsState }) =>
  state.assets;

export const selectAssetById = (
  state: { assets: AssetsState },
  assetId: string
) => state.assets.byId[assetId] ?? null;

export const selectAllAssetIds = (state: { assets: AssetsState }) =>
  state.assets.allIds;

export const selectAllAssets = (state: { assets: AssetsState }) =>
  state.assets.allIds
    .map((id) => state.assets.byId[id])
    .filter(Boolean);

export const selectAssetsBySource = (
  state: { assets: AssetsState },
  source: Asset['source']
) =>
  state.assets.allIds
    .map((id) => state.assets.byId[id])
    .filter((a): a is Asset => !!a && a.source === source);

export const selectAssetsCount = (state: { assets: AssetsState }) =>
  state.assets.allIds.length;

export default assetsSlice.reducer;