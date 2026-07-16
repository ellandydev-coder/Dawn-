// src/state/slices/preferences/preferencesSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import {
  createDefaultVstPreferences,
  type VstPreferences,
} from '@domain/models/preferences/VstPreferences';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/**
 * Estado global de Preferences.
 *
 * Organización anidada por categoría:
 *   preferences.vst          → panel VST
 *   preferences.midiEditor   → panel MIDI Editor (futuro)
 *   preferences.audioDevice  → panel Audio Device (futuro)
 *   ...
 *
 * Cada categoría tiene su propio subárbol con sus settings tipadas.
 * Los reducers son atómicos: uno por setting, o `patchVst` para
 * actualizaciones parciales desde el panel completo.
 */
export interface PreferencesState {
  vst: VstPreferences;
  // Futuros:
  // audioDevice: AudioDevicePreferences;
  // midiEditor: MidiEditorPreferences;
  // ...
}

// ═══════════════════════════════════════════════════════════════
// 🎯 INITIAL STATE
// ═══════════════════════════════════════════════════════════════

const createInitialState = (): PreferencesState => ({
  vst: createDefaultVstPreferences(),
});

// ═══════════════════════════════════════════════════════════════
// 🏪 SLICE
// ═══════════════════════════════════════════════════════════════

const initialState: PreferencesState = createInitialState();

const preferencesSlice = createSlice({
  name: 'preferences',
  initialState,
  reducers: {
    // ─── VST: patch parcial ────────────────────────────────
    /**
     * Actualiza N settings del panel VST en una sola acción.
     * Útil desde el panel para agrupar cambios o para "reset a defaults".
     */
    patchVst(state, action: PayloadAction<Partial<VstPreferences>>) {
      state.vst = { ...state.vst, ...action.payload };
    },

    /**
     * Restaura los valores por defecto del panel VST.
     * Útil para un botón "Reset to defaults" futuro.
     */
    resetVst(state) {
      state.vst = createDefaultVstPreferences();
    },

    // ─── Reset global ──────────────────────────────────────
    /**
     * Restaura TODAS las preferences a sus defaults.
     * Solo se usa en dev / testing o en un botón global de reset.
     */
    resetAllPreferences() {
      return createInitialState();
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: ACCIONES
// ═══════════════════════════════════════════════════════════════

export const {
  patchVst,
  resetVst,
  resetAllPreferences,
} = preferencesSlice.actions;

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: SELECTORES
// ═══════════════════════════════════════════════════════════════

type PreferencesRootState = { preferences: PreferencesState };

export const selectPreferencesState = (
  s: PreferencesRootState
): PreferencesState => s.preferences;

/** Preferencias del panel VST completas */
export const selectVstPreferences = (
  s: PreferencesRootState
): VstPreferences => s.preferences.vst;

export default preferencesSlice.reducer;