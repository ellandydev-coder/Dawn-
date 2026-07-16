// src/state/slices/pluginScan/pluginScanSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/**
 * Estado del scanner de plugins.
 *
 * Contiene metadatos del último escaneo — los plugins reales viven
 * en el `FxCatalog` (singleton), aquí solo guardamos qué ids se
 * añadieron y cuándo. Esto prepara terreno para el cache
 * persistente futuro (Hito D).
 */
export interface PluginScanState {
  /** ¿Hay un escaneo en curso? */
  isScanning: boolean;

  /** Progreso del escaneo (0..1) */
  progress: number;

  /** Nombre del plugin que se está procesando ahora */
  currentPluginName: string | null;

  /** Timestamp del último escaneo completado (null si nunca) */
  lastScanDate: number | null;

  /** Duración del último escaneo en ms */
  lastScanDurationMs: number | null;

  /** Mensaje de error si falló el último escaneo */
  lastError: string | null;

  /**
   * Ids de plugins registrados en el último escaneo.
   * Se usa para invalidar (unregister) antes de re-scan.
   */
  foundIds: string[];
}

// ═══════════════════════════════════════════════════════════════
// 🎯 INITIAL STATE
// ═══════════════════════════════════════════════════════════════

const initialState: PluginScanState = {
  isScanning: false,
  progress: 0,
  currentPluginName: null,
  lastScanDate: null,
  lastScanDurationMs: null,
  lastError: null,
  foundIds: [],
};

// ═══════════════════════════════════════════════════════════════
// 🏪 SLICE
// ═══════════════════════════════════════════════════════════════

const pluginScanSlice = createSlice({
  name: 'pluginScan',
  initialState,
  reducers: {
    /** Arranca un nuevo escaneo (reset progress + error) */
    scanStarted(state) {
      state.isScanning = true;
      state.progress = 0;
      state.currentPluginName = null;
      state.lastError = null;
    },

    /** Actualiza el progreso durante el escaneo */
    scanProgressUpdated(
      state,
      action: PayloadAction<{ progress: number; currentName: string }>
    ) {
      state.progress = action.payload.progress;
      state.currentPluginName = action.payload.currentName;
    },

    /** Escaneo completado con éxito */
    scanFinished(
      state,
      action: PayloadAction<{
        foundIds: string[];
        durationMs: number;
      }>
    ) {
      state.isScanning = false;
      state.progress = 1;
      state.currentPluginName = null;
      state.lastScanDate = Date.now();
      state.lastScanDurationMs = action.payload.durationMs;
      state.foundIds = action.payload.foundIds;
    },

    /** Escaneo falló con un error */
    scanFailed(state, action: PayloadAction<string>) {
      state.isScanning = false;
      state.progress = 0;
      state.currentPluginName = null;
      state.lastError = action.payload;
    },

    /** Reset manual del estado (útil para tests / botón "clear") */
    resetPluginScan() {
      return initialState;
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: ACCIONES
// ═══════════════════════════════════════════════════════════════

export const {
  scanStarted,
  scanProgressUpdated,
  scanFinished,
  scanFailed,
  resetPluginScan,
} = pluginScanSlice.actions;

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: SELECTORES
// ═══════════════════════════════════════════════════════════════

type PluginScanRootState = { pluginScan: PluginScanState };

export const selectPluginScanState = (
  s: PluginScanRootState
): PluginScanState => s.pluginScan;

export const selectIsScanning = (s: PluginScanRootState): boolean =>
  s.pluginScan.isScanning;

export const selectScanProgress = (s: PluginScanRootState): number =>
  s.pluginScan.progress;

export const selectCurrentPluginName = (
  s: PluginScanRootState
): string | null => s.pluginScan.currentPluginName;

export const selectLastScanDate = (
  s: PluginScanRootState
): number | null => s.pluginScan.lastScanDate;

export const selectFoundIds = (s: PluginScanRootState): readonly string[] =>
  s.pluginScan.foundIds;

export default pluginScanSlice.reducer;