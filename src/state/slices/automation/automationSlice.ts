// src/state/slices/automation/automationSlice.ts

import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { AutomationLane, AutomationPoint } from '@domain/models/AutomationLane';
import { type AutomationMode, isAutomationMode } from '@domain/enums/AutomationMode';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface AutomationSliceState {
  byId: Record<string, AutomationLane>;
  allIds: string[];
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

function hasLane(state: AutomationSliceState, id: string): boolean {
  return id in state.byId;
}

function sortPoints(points: AutomationPoint[]): AutomationPoint[] {
  return points.slice().sort((a, b) => a.time - b.time);
}

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const createInitialState = (): AutomationSliceState => ({
  byId: {},
  allIds: [],
});

// ═══════════════════════════════════════════════════════════════
// 🏪 SLICE
// ═══════════════════════════════════════════════════════════════

const initialState: AutomationSliceState = createInitialState();

const automationSlice = createSlice({
  name: 'automation',
  initialState,
  reducers: {
    // ─── LANE CRUD ───────────────────────────────────────────

    /**
     * Añade una lane. Idempotente: no duplica si ya existe.
     */
    addLane(state, action: PayloadAction<AutomationLane>) {
      const lane = action.payload;
      if (hasLane(state, lane.id)) return;

      state.byId[lane.id] = lane;
      state.allIds.push(lane.id);
    },

    removeLane(state, action: PayloadAction<string>) {
      const id = action.payload;
      if (!hasLane(state, id)) return;

      delete state.byId[id];
      state.allIds = state.allIds.filter((lid) => lid !== id);
    },

    /**
     * Elimina todas las lanes de un track.
     * Llamado desde deleteTrackCascade.
     */
    removeLanesByTrack(state, action: PayloadAction<string>) {
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

    /**
     * Elimina todas las lanes asociadas a un efecto.
     * Llamado al remover un insert de la cadena.
     */
    removeLanesByTarget(
      state,
      action: PayloadAction<{ targetId: string; targetType: 'track' | 'effect' }>
    ) {
      const { targetId, targetType } = action.payload;
      const toRemove = new Set<string>();

      for (const id of state.allIds) {
        const lane = state.byId[id];
        if (lane?.targetId === targetId && lane.targetType === targetType) {
          toRemove.add(id);
        }
      }

      if (toRemove.size === 0) return;

      for (const id of toRemove) {
        delete state.byId[id];
      }

      state.allIds = state.allIds.filter((id) => !toRemove.has(id));
    },

    // ─── LANE STATE ──────────────────────────────────────────

    toggleLane(state, action: PayloadAction<string>) {
      const lane = state.byId[action.payload];
      if (!lane) return;

      lane.enabled = !lane.enabled;
    },

    setLaneEnabled(
      state,
      action: PayloadAction<{ laneId: string; enabled: boolean }>
    ) {
      const lane = state.byId[action.payload.laneId];
      if (!lane) return;

      lane.enabled = action.payload.enabled;
    },

    /**
     * Cambia el modo de automatización de una lane.
     * Valida que sea un AutomationMode conocido.
     */
    setLaneMode(
      state,
      action: PayloadAction<{ laneId: string; mode: AutomationMode }>
    ) {
      const lane = state.byId[action.payload.laneId];
      if (!lane) return;

      if (!isAutomationMode(action.payload.mode)) {
        console.warn(
          `[automationSlice] Modo desconocido: "${action.payload.mode}"`
        );
        return;
      }

      lane.mode = action.payload.mode;
    },

    /**
     * Cambia el modo de todas las lanes de un track a la vez.
     * Útil para el botón global de modo en el TrackHeader.
     */
    setTrackLanesMode(
      state,
      action: PayloadAction<{ trackId: string; mode: AutomationMode }>
    ) {
      if (!isAutomationMode(action.payload.mode)) return;

      for (const id of state.allIds) {
        const lane = state.byId[id];
        if (lane?.trackId === action.payload.trackId) {
          lane.mode = action.payload.mode;
        }
      }
    },

    // ─── POINTS CRUD ─────────────────────────────────────────

    /**
     * Añade un punto a la lane, mantiene el orden por tiempo.
     * Si ya existe un punto con el mismo ID, no lo duplica.
     */
    addPoint(
      state,
      action: PayloadAction<{ laneId: string; point: AutomationPoint }>
    ) {
      const lane = state.byId[action.payload.laneId];
      if (!lane) return;

      const { point } = action.payload;

      // Idempotente
      if (lane.points.some((p) => p.id === point.id)) return;

      // Clamp value al rango del parámetro
      const safePoint: AutomationPoint = {
        ...point,
        time: Math.max(0, point.time),
        value: clampValue(point.value, lane.minValue, lane.maxValue),
      };

      lane.points.push(safePoint);
      lane.points = sortPoints(lane.points);
    },

    /**
     * Añade múltiples puntos de una vez (p.ej. al pegar o grabar).
     * Eficiente: ordena solo una vez al final.
     */
    addPoints(
      state,
      action: PayloadAction<{ laneId: string; points: AutomationPoint[] }>
    ) {
      const lane = state.byId[action.payload.laneId];
      if (!lane) return;

      const existingIds = new Set(lane.points.map((p) => p.id));

      for (const point of action.payload.points) {
        if (existingIds.has(point.id)) continue;

        lane.points.push({
          ...point,
          time: Math.max(0, point.time),
          value: clampValue(point.value, lane.minValue, lane.maxValue),
        });

        existingIds.add(point.id);
      }

      lane.points = sortPoints(lane.points);
    },

    removePoint(
      state,
      action: PayloadAction<{ laneId: string; pointId: string }>
    ) {
      const lane = state.byId[action.payload.laneId];
      if (!lane) return;

      lane.points = lane.points.filter(
        (p) => p.id !== action.payload.pointId
      );
    },

    /**
     * Elimina múltiples puntos de una lane de una vez.
     * Útil para borrar una selección de puntos.
     */
    removePoints(
      state,
      action: PayloadAction<{ laneId: string; pointIds: string[] }>
    ) {
      const lane = state.byId[action.payload.laneId];
      if (!lane) return;

      const toRemove = new Set(action.payload.pointIds);
      lane.points = lane.points.filter((p) => !toRemove.has(p.id));
    },

    updatePoint(
      state,
      action: PayloadAction<{
        laneId: string;
        pointId: string;
        time?: number;
        value?: number;
        curve?: AutomationPoint['curve'];
      }>
    ) {
      const lane = state.byId[action.payload.laneId];
      if (!lane) return;

      const point = lane.points.find((p) => p.id === action.payload.pointId);
      if (!point) return;

      if (action.payload.time !== undefined) {
        point.time = Math.max(0, action.payload.time);
      }

      if (action.payload.value !== undefined) {
        point.value = clampValue(
          action.payload.value,
          lane.minValue,
          lane.maxValue
        );
      }

      if (action.payload.curve !== undefined) {
        point.curve = action.payload.curve;
      }

      // Re-ordenar solo si el tiempo cambió
      if (action.payload.time !== undefined) {
        lane.points = sortPoints(lane.points);
      }
    },

    /**
     * Elimina todos los puntos de una lane.
     * Para la acción "Clear automation".
     */
    clearLanePoints(state, action: PayloadAction<string>) {
      const lane = state.byId[action.payload];
      if (!lane) return;

      lane.points = [];
    },

    // ─── BULK / PROYECTO ────────────────────────────────────

    /**
     * Carga completa de lanes (abrir proyecto).
     */
    replaceLanes(state, action: PayloadAction<AutomationLane[]>) {
      state.byId = {};
      state.allIds = [];

      for (const lane of action.payload) {
        if (state.byId[lane.id]) continue;

        state.byId[lane.id] = lane;
        state.allIds.push(lane.id);
      }
    },

    resetAutomation() {
      return createInitialState();
    },
  },
});

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: ACCIONES
// ═══════════════════════════════════════════════════════════════

export const {
  // Lane CRUD
  addLane,
  removeLane,
  removeLanesByTrack,
  removeLanesByTarget,
  // Lane state
  toggleLane,
  setLaneEnabled,
  setLaneMode,
  setTrackLanesMode,
  // Points CRUD
  addPoint,
  addPoints,
  removePoint,
  removePoints,
  updatePoint,
  clearLanePoints,
  // Bulk / proyecto
  replaceLanes,
  resetAutomation,
} = automationSlice.actions;

// ═══════════════════════════════════════════════════════════════
// 📤 EXPORTS: SELECTORES BÁSICOS
// ═══════════════════════════════════════════════════════════════

export const selectAutomationState = (
  state: { automation: AutomationSliceState }
) => state.automation;

export const selectLaneById = (
  state: { automation: AutomationSliceState },
  laneId: string
) => state.automation.byId[laneId] ?? null;

export const selectAllLanes = (
  state: { automation: AutomationSliceState }
) =>
  state.automation.allIds
    .map((id) => state.automation.byId[id])
    .filter(Boolean);

export const selectLanesByTrackId = (
  state: { automation: AutomationSliceState },
  trackId: string
) =>
  state.automation.allIds
    .map((id) => state.automation.byId[id])
    .filter((l): l is AutomationLane => !!l && l.trackId === trackId);

export const selectLanesByParameter = (
  state: { automation: AutomationSliceState },
  trackId: string,
  parameter: string
) =>
  state.automation.allIds
    .map((id) => state.automation.byId[id])
    .filter(
      (l): l is AutomationLane =>
        !!l && l.trackId === trackId && l.parameter === parameter
    );

export const selectPointsByLaneId = (
  state: { automation: AutomationSliceState },
  laneId: string
) => state.automation.byId[laneId]?.points ?? [];

export const selectAutomationCount = (
  state: { automation: AutomationSliceState }
) => state.automation.allIds.length;

export default automationSlice.reducer;