// src/state/slices/effects/effectsSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { type Effect, createEffect } from '@domain/models/Effect';
import { type EffectType, isEffectType } from '@domain/enums/EffectType';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface EffectsSliceState {
  byId: Record<string, Effect>;
  allIds: string[];
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

function hasEffect(state: EffectsSliceState, id: string): boolean {
  return id in state.byId;
}

const createInitialState = (): EffectsSliceState => ({
  byId: {},
  allIds: [],
});

// ═══════════════════════════════════════════════════════════════
// 🏪 SLICE
// ═══════════════════════════════════════════════════════════════

const initialState: EffectsSliceState = createInitialState();

const effectsSlice = createSlice({
  name: 'effects',
  initialState,
  reducers: {
    // ─── CRUD ────────────────────────────────────────────────

    addEffect: {
      reducer(state, action: PayloadAction<Effect>) {
        const effect = action.payload;

        // Idempotente: no duplicar
        if (hasEffect(state, effect.id)) return;

        state.byId[effect.id] = effect;
        state.allIds.push(effect.id);
      },
      prepare(payload: {
        id: string;
        trackId: string;
        type: string;
        name?: string;
        parameters?: Record<string, number>;
        position?: number;
      }) {
        // Validar que el type sea un EffectType conocido
        if (!isEffectType(payload.type)) {
          console.warn(
            `[effectsSlice] Tipo de efecto desconocido: "${payload.type}"`
          );
        }

        const effect = createEffect({
          id: payload.id,
          trackId: payload.trackId,
          type: payload.type,
          name: payload.name,
          parameters: payload.parameters,
          position: payload.position,
        });

        return { payload: effect };
      },
    },

    removeEffect(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!hasEffect(state, id)) return;

      delete state.byId[id];
      state.allIds = state.allIds.filter((eid) => eid !== id);
    },

    /**
     * Elimina múltiples efectos de una vez.
     * Llamado cuando se elimina un track con su insert chain.
     */
    removeEffects(state, action: PayloadAction<string[]>) {
      const toRemove = new Set(action.payload);
      if (toRemove.size === 0) return;

      for (const id of toRemove) {
        delete state.byId[id];
      }

      state.allIds = state.allIds.filter((id) => !toRemove.has(id));
    },

    /**
     * Elimina todos los efectos de un track.
     * Llamado desde deleteTrackCascade.
     */
    removeEffectsByTrack(state, action: PayloadAction<string>) {
      const trackId = action.payload;
      const toRemove = new Set<string>();

      for (const id of state.allIds) {
        if (state.byId[id]?.trackId === trackId) {
          toRemove.add(id);
        }
      }

      if (toRemove.size === 0) return;

      for (const id of toRemove) {
        delete state.byId[id];
      }

      state.allIds = state.allIds.filter((id) => !toRemove.has(id));
    },

    // ─── BYPASS ──────────────────────────────────────────────

    toggleBypass(state, action: PayloadAction<string>) {
      const effect = state.byId[action.payload];
      if (!effect) return;

      effect.bypassed = !effect.bypassed;
    },

    setBypass(
      state,
      action: PayloadAction<{ effectId: string; bypassed: boolean }>
    ) {
      const effect = state.byId[action.payload.effectId];
      if (!effect) return;

      effect.bypassed = action.payload.bypassed;
    },

    /**
     * Bypass de todos los efectos de un track de una vez.
     * Equivale al botón FX bypass global del ChannelStrip.
     */
    setTrackEffectsBypassed(
      state,
      action: PayloadAction<{ trackId: string; bypassed: boolean }>
    ) {
      const { trackId, bypassed } = action.payload;

      for (const id of state.allIds) {
        const effect = state.byId[id];
        if (effect?.trackId === trackId) {
          effect.bypassed = bypassed;
        }
      }
    },

    // ─── PARÁMETROS ──────────────────────────────────────────

    setEffectParameter(
      state,
      action: PayloadAction<{
        effectId: string;
        param: string;
        value: number;
      }>
    ) {
      const effect = state.byId[action.payload.effectId];
      if (!effect) return;

      effect.parameters[action.payload.param] = action.payload.value;
    },

    /**
     * Actualiza múltiples parámetros en una sola acción.
     * Útil al cargar un preset completo.
     */
    setEffectParameters(
      state,
      action: PayloadAction<{
        effectId: string;
        parameters: Record<string, number>;
      }>
    ) {
      const effect = state.byId[action.payload.effectId];
      if (!effect) return;

      effect.parameters = {
        ...effect.parameters,
        ...action.payload.parameters,
      };
    },

    /**
     * Resetea los parámetros de un efecto (limpia a objeto vacío).
     * El audio engine usará los defaults del procesador.
     */
    resetEffectParameters(state, action: PayloadAction<string>) {
      const effect = state.byId[action.payload];
      if (!effect) return;

      effect.parameters = {};
    },

    // ─── PRESET ──────────────────────────────────────────────

    setEffectPreset(
      state,
      action: PayloadAction<{
        effectId: string;
        presetName: string;
        parameters: Record<string, number>;
      }>
    ) {
      const effect = state.byId[action.payload.effectId];
      if (!effect) return;

      effect.presetName = action.payload.presetName;
      effect.parameters = { ...action.payload.parameters };
    },

    clearEffectPreset(state, action: PayloadAction<string>) {
      const effect = state.byId[action.payload];
      if (!effect) return;

      effect.presetName = undefined;
    },

    // ─── NOMBRE ──────────────────────────────────────────────

    renameEffect(
      state,
      action: PayloadAction<{ effectId: string; name: string }>
    ) {
      const effect = state.byId[action.payload.effectId];
      if (!effect) return;

      const name = action.payload.name.trim();
      if (!name || effect.name === name) return;

      effect.name = name;
    },

    // ─── POSICIÓN ────────────────────────────────────────────

    /**
     * Actualiza la posición de un efecto en la cadena.
     * La posición real en el insert chain la gestiona mixerSlice
     * (array de insertIds). Esto es solo metadata de orden.
     */
    setEffectPosition(
      state,
      action: PayloadAction<{ effectId: string; position: number }>
    ) {
      const effect = state.byId[action.payload.effectId];
      if (!effect) return;

      effect.position = Math.max(0, action.payload.position);
    },

    // ─── BULK / PROYECTO ────────────────────────────────────

    /**
     * Carga completa de efectos (abrir proyecto).
     */
    replaceEffects(state, action: PayloadAction<Effect[]>) {
      state.byId = {};
      state.allIds = [];

      for (const effect of action.payload) {
        if (state.byId[effect.id]) continue;

        state.byId[effect.id] = effect;
        state.allIds.push(effect.id);
      }
    },

    resetEffects() {
      return createInitialState();
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: ACCIONES
// ═══════════════════════════════════════════════════════════════

export const {
  // CRUD
  addEffect,
  removeEffect,
  removeEffects,
  removeEffectsByTrack,
  // Bypass
  toggleBypass,
  setBypass,
  setTrackEffectsBypassed,
  // Parámetros
  setEffectParameter,
  setEffectParameters,
  resetEffectParameters,
  // Preset
  setEffectPreset,
  clearEffectPreset,
  // Nombre
  renameEffect,
  // Posición
  setEffectPosition,
  // Bulk / proyecto
  replaceEffects,
  resetEffects,
} = effectsSlice.actions;

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: SELECTORES BÁSICOS
// ═══════════════════════════════════════════════════════════════

export const selectEffectsState = (state: { effects: EffectsSliceState }) =>
  state.effects;

export const selectEffectById = (
  state: { effects: EffectsSliceState },
  effectId: string
) => state.effects.byId[effectId] ?? null;

export const selectAllEffectIds = (state: { effects: EffectsSliceState }) =>
  state.effects.allIds;

export const selectAllEffects = (state: { effects: EffectsSliceState }) =>
  state.effects.allIds
    .map((id) => state.effects.byId[id])
    .filter(Boolean);

/**
 * Efectos de un track ordenados por position.
 */
export const selectEffectsByTrackId = (
  state: { effects: EffectsSliceState },
  trackId: string
) =>
  state.effects.allIds
    .map((id) => state.effects.byId[id])
    .filter((e): e is Effect => !!e && e.trackId === trackId)
    .sort((a, b) => a.position - b.position);

/**
 * Efectos de un track filtrados por EffectType.
 */
export const selectEffectsByType = (
  state: { effects: EffectsSliceState },
  type: EffectType
) =>
  state.effects.allIds
    .map((id) => state.effects.byId[id])
    .filter((e): e is Effect => !!e && e.type === type);

export const selectEffectsCount = (state: { effects: EffectsSliceState }) =>
  state.effects.allIds.length;

export default effectsSlice.reducer;