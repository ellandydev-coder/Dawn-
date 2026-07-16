/**
 * automationSelectors.ts
 * ----------------------
 * Selectores memoizados para el slice de automation lanes.
 *
 * Convenciones:
 * - Selectores base: O(1), sin memoización
 * - Selectores derivados: createSelector, memoizados
 * - Fábricas (makeSelect*): un selector por instancia de componente
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@state/store';
import type { AutomationLane, AutomationPoint } from '@domain/models/AutomationLane';

// ═══════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════

type AutomationTargetType = AutomationLane['targetType'];
type AutomationMode = AutomationLane['mode'];

// ═══════════════════════════════════════════
// Selectores base (O(1), sin memoización)
// ═══════════════════════════════════════════

export const selectAutomationById = (state: RootState) =>
  state.automation.byId;

export const selectAutomationAllIds = (state: RootState) =>
  state.automation.allIds;

/** Acceso atómico a una lane por id */
export const selectAutomationLaneById = (
  state: RootState,
  laneId: string
): AutomationLane | null => state.automation.byId[laneId] ?? null;

// ═══════════════════════════════════════════
// Selectores derivados — listas
// ═══════════════════════════════════════════

/** Todas las automation lanes (ordenadas según allIds) */
export const selectAllAutomationLanes = createSelector(
  [selectAutomationById, selectAutomationAllIds],
  (byId, allIds): AutomationLane[] =>
    allIds.reduce<AutomationLane[]>((acc, id) => {
      const lane = byId[id];
      if (lane) acc.push(lane);
      return acc;
    }, [])
);

/** Cantidad total de lanes */
export const selectAutomationLanesCount = createSelector(
  [selectAutomationAllIds],
  (ids): number => ids.length
);

/** true si hay al menos una lane */
export const selectHasAutomationLanes = createSelector(
  [selectAutomationAllIds],
  (ids): boolean => ids.length > 0
);

// ═══════════════════════════════════════════
// Selectores por track
// ═══════════════════════════════════════════

/** Lanes que pertenecen a una track específica */
export const selectAutomationLanesByTrackId = createSelector(
  [selectAutomationById, selectAutomationAllIds, (_: RootState, trackId: string) => trackId],
  (byId, allIds, trackId): AutomationLane[] =>
    allIds.reduce<AutomationLane[]>((acc, id) => {
      const lane = byId[id];
      if (lane && lane.trackId === trackId) acc.push(lane);
      return acc;
    }, [])
);

/** IDs de lanes de una track */
export const selectAutomationLaneIdsByTrackId = createSelector(
  [selectAutomationById, selectAutomationAllIds, (_: RootState, trackId: string) => trackId],
  (byId, allIds, trackId): string[] =>
    allIds.filter((id) => byId[id]?.trackId === trackId)
);

/** true si una track tiene automation lanes */
export const selectTrackHasAutomation = createSelector(
  [selectAutomationById, selectAutomationAllIds, (_: RootState, trackId: string) => trackId],
  (byId, allIds, trackId): boolean =>
    allIds.some((id) => byId[id]?.trackId === trackId)
);

// ═══════════════════════════════════════════
// Selectores por target (track o effect)
// ═══════════════════════════════════════════

/** Lanes por target type + target id */
export const selectAutomationLanesByTarget = createSelector(
  [
    selectAutomationById,
    selectAutomationAllIds,
    (_: RootState, params: { targetType: AutomationTargetType; targetId: string }) => params,
  ],
  (byId, allIds, { targetType, targetId }): AutomationLane[] =>
    allIds.reduce<AutomationLane[]>((acc, id) => {
      const lane = byId[id];
      if (lane && lane.targetType === targetType && lane.targetId === targetId) {
        acc.push(lane);
      }
      return acc;
    }, [])
);

/** Lanes de un parámetro específico de un target */
export const selectAutomationLaneByParameter = createSelector(
  [
    selectAutomationById,
    selectAutomationAllIds,
    (_: RootState, params: { targetId: string; parameter: string }) => params,
  ],
  (byId, allIds, { targetId, parameter }): AutomationLane | null => {
    for (const id of allIds) {
      const lane = byId[id];
      if (lane && lane.targetId === targetId && lane.parameter === parameter) {
        return lane;
      }
    }
    return null;
  }
);

// ═══════════════════════════════════════════
// Selectores por estado (enabled / mode)
// ═══════════════════════════════════════════

/** Lanes habilitadas */
export const selectEnabledAutomationLanes = createSelector(
  [selectAllAutomationLanes],
  (lanes): AutomationLane[] => lanes.filter((lane) => lane.enabled)
);

/** Lanes en modo write o touch (están grabando automation) */
export const selectWritingAutomationLanes = createSelector(
  [selectAllAutomationLanes],
  (lanes): AutomationLane[] =>
    lanes.filter((lane) => lane.mode === 'write' || lane.mode === 'touch')
);

/** true si alguna lane está en modo write o touch */
export const selectIsAutomationWriting = createSelector(
  [selectWritingAutomationLanes],
  (lanes): boolean => lanes.length > 0
);

/** Lanes filtradas por modo */
export const selectAutomationLanesByMode = createSelector(
  [selectAllAutomationLanes, (_: RootState, mode: AutomationMode) => mode],
  (lanes, mode): AutomationLane[] =>
    lanes.filter((lane) => lane.mode === mode)
);

// ═══════════════════════════════════════════
// Selectores de puntos
// ═══════════════════════════════════════════

/** Puntos de una lane específica */
export const selectAutomationPoints = createSelector(
  [selectAutomationById, (_: RootState, laneId: string) => laneId],
  (byId, laneId): AutomationPoint[] => byId[laneId]?.points ?? []
);

/** Cantidad de puntos de una lane */
export const selectAutomationPointsCount = createSelector(
  [selectAutomationPoints],
  (points): number => points.length
);

/**
 * Puntos de una lane que caen dentro de un rango de tiempo.
 * Útil para renderizar solo puntos visibles en el viewport.
 */
export const selectAutomationPointsInRange = createSelector(
  [
    selectAutomationById,
    (_: RootState, params: { laneId: string; start: number; end: number }) => params,
  ],
  (byId, { laneId, start, end }): AutomationPoint[] => {
    const points = byId[laneId]?.points;
    if (!points || start >= end) return [];

    return points.filter((p) => p.time >= start && p.time <= end);
  }
);

// ═══════════════════════════════════════════
// Fábricas de selectores (por instancia)
// ═══════════════════════════════════════════

/**
 * Crea un selector memoizado para una lane específica.
 *
 * @example
 * const selectLane = useMemo(() => makeSelectAutomationLaneById(laneId), [laneId]);
 * const lane = useAppSelector(selectLane);
 */
export const makeSelectAutomationLaneById = (laneId: string) =>
  createSelector(
    [selectAutomationById],
    (byId): AutomationLane | null => byId[laneId] ?? null
  );

/**
 * Crea un selector memoizado para lanes de una track.
 *
 * @example
 * const selectLanes = useMemo(() => makeSelectAutomationLanesByTrackId(trackId), [trackId]);
 * const lanes = useAppSelector(selectLanes);
 */
export const makeSelectAutomationLanesByTrackId = (trackId: string) =>
  createSelector(
    [selectAutomationById, selectAutomationAllIds],
    (byId, allIds): AutomationLane[] =>
      allIds.reduce<AutomationLane[]>((acc, id) => {
        const lane = byId[id];
        if (lane && lane.trackId === trackId) acc.push(lane);
        return acc;
      }, [])
  );

/**
 * Crea un selector memoizado para lanes de un target.
 *
 * @example
 * const selectLanes = useMemo(
 *   () => makeSelectAutomationLanesByTarget('effect', effectId),
 *   [effectId]
 * );
 */
export const makeSelectAutomationLanesByTarget = (
  targetType: AutomationTargetType,
  targetId: string
) =>
  createSelector(
    [selectAutomationById, selectAutomationAllIds],
    (byId, allIds): AutomationLane[] =>
      allIds.reduce<AutomationLane[]>((acc, id) => {
        const lane = byId[id];
        if (lane && lane.targetType === targetType && lane.targetId === targetId) {
          acc.push(lane);
        }
        return acc;
      }, [])
  );

/**
 * Crea un selector para los puntos de una lane.
 *
 * @example
 * const selectPoints = useMemo(() => makeSelectAutomationPoints(laneId), [laneId]);
 * const points = useAppSelector(selectPoints);
 */
export const makeSelectAutomationPoints = (laneId: string) =>
  createSelector(
    [selectAutomationById],
    (byId): AutomationPoint[] => byId[laneId]?.points ?? []
  );