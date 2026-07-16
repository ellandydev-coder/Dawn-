/**
 * effectsSelectors.ts
 * -------------------
 * Selectores memoizados para el slice de efectos.
 *
 * Convenciones:
 * - Selectores base: O(1), sin memoización
 * - Selectores derivados: createSelector, memoizados
 * - Fábricas (makeSelect*): un selector por instancia de componente
 * - Los efectos por track se devuelven ordenados por `position`
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@state/store';
import type { Effect } from '@domain/models/Effect';

// ═══════════════════════════════════════════
// Selectores base (O(1), sin memoización)
// ═══════════════════════════════════════════

export const selectEffectsById = (state: RootState) => state.effects.byId;
export const selectEffectsAllIds = (state: RootState) => state.effects.allIds;

/** Acceso atómico a un efecto por id */
export const selectEffectById = (
  state: RootState,
  effectId: string
): Effect | null => state.effects.byId[effectId] ?? null;

// ═══════════════════════════════════════════
// Selectores derivados — listas
// ═══════════════════════════════════════════

/** Todos los efectos (ordenados según allIds) */
export const selectAllEffects = createSelector(
  [selectEffectsById, selectEffectsAllIds],
  (byId, allIds): Effect[] =>
    allIds.reduce<Effect[]>((acc, id) => {
      const effect = byId[id];
      if (effect) acc.push(effect);
      return acc;
    }, [])
);

/** Cantidad total de efectos */
export const selectEffectsCount = createSelector(
  [selectEffectsAllIds],
  (ids): number => ids.length
);

/** true si hay al menos un efecto */
export const selectHasEffects = createSelector(
  [selectEffectsAllIds],
  (ids): boolean => ids.length > 0
);

// ═══════════════════════════════════════════
// Selectores por track
// ═══════════════════════════════════════════

/**
 * Comparador para ordenar efectos por position.
 * Extraído como constante para evitar recrear la función.
 */
const byPosition = (a: Effect, b: Effect): number => a.position - b.position;

/** Efectos de una track, ordenados por position */
export const selectEffectsByTrackId = createSelector(
  [selectEffectsById, selectEffectsAllIds, (_: RootState, trackId: string) => trackId],
  (byId, allIds, trackId): Effect[] =>
    allIds
      .reduce<Effect[]>((acc, id) => {
        const effect = byId[id];
        if (effect && effect.trackId === trackId) acc.push(effect);
        return acc;
      }, [])
      .sort(byPosition)
);

/** IDs de efectos de una track, ordenados por position */
export const selectEffectIdsByTrackId = createSelector(
  [selectEffectsByTrackId],
  (effects): string[] => effects.map((e) => e.id)
);

/** Cantidad de efectos en una track */
export const selectEffectsCountByTrackId = createSelector(
  [selectEffectsById, selectEffectsAllIds, (_: RootState, trackId: string) => trackId],
  (byId, allIds, trackId): number =>
    allIds.reduce((count, id) => (byId[id]?.trackId === trackId ? count + 1 : count), 0)
);

/** true si una track tiene al menos un efecto */
export const selectTrackHasEffects = createSelector(
  [selectEffectsById, selectEffectsAllIds, (_: RootState, trackId: string) => trackId],
  (byId, allIds, trackId): boolean =>
    allIds.some((id) => byId[id]?.trackId === trackId)
);

// ═══════════════════════════════════════════
// Selectores por tipo
// ═══════════════════════════════════════════

/** Efectos filtrados por tipo */
export const selectEffectsByType = createSelector(
  [selectEffectsById, selectEffectsAllIds, (_: RootState, type: string) => type],
  (byId, allIds, type): Effect[] =>
    allIds.reduce<Effect[]>((acc, id) => {
      const effect = byId[id];
      if (effect && effect.type === type) acc.push(effect);
      return acc;
    }, [])
);

// ═══════════════════════════════════════════
// Selectores de estado (bypass)
// ═══════════════════════════════════════════

/** true si un efecto específico está bypaseado */
export const selectIsEffectBypassed = (
  state: RootState,
  effectId: string
): boolean => state.effects.byId[effectId]?.bypassed ?? false;

/** Efectos bypaseados de una track */
export const selectBypassedEffectsByTrackId = createSelector(
  [selectEffectsByTrackId],
  (effects): Effect[] => effects.filter((e) => e.bypassed)
);

/** Efectos activos (no bypaseados) de una track */
export const selectActiveEffectsByTrackId = createSelector(
  [selectEffectsByTrackId],
  (effects): Effect[] => effects.filter((e) => !e.bypassed)
);

/** true si todos los efectos de una track están bypaseados */
export const selectAllEffectsBypassedForTrack = createSelector(
  [selectEffectsByTrackId],
  (effects): boolean => effects.length > 0 && effects.every((e) => e.bypassed)
);

// ═══════════════════════════════════════════
// Selectores de parámetros
// ═══════════════════════════════════════════

/** Parámetros de un efecto específico */
export const selectEffectParameters = createSelector(
  [selectEffectsById, (_: RootState, effectId: string) => effectId],
  (byId, effectId): Record<string, number> => byId[effectId]?.parameters ?? {}
);

/** Valor de un parámetro concreto de un efecto */
export const selectEffectParameterValue = (
  state: RootState,
  effectId: string,
  paramName: string
): number | undefined => state.effects.byId[effectId]?.parameters[paramName];

/** Preset name de un efecto (si tiene) */
export const selectEffectPresetName = (
  state: RootState,
  effectId: string
): string | undefined => state.effects.byId[effectId]?.presetName;

// ═══════════════════════════════════════════
// Selectores de tracks con efectos
// ═══════════════════════════════════════════

/** IDs de tracks que tienen al menos un efecto */
export const selectTrackIdsWithEffects = createSelector(
  [selectEffectsById, selectEffectsAllIds],
  (byId, allIds): string[] => {
    const trackIds = new Set<string>();
    for (const id of allIds) {
      const trackId = byId[id]?.trackId;
      if (trackId) trackIds.add(trackId);
    }
    return Array.from(trackIds);
  }
);

// ═══════════════════════════════════════════
// Fábricas de selectores (por instancia)
// ═══════════════════════════════════════════

/**
 * Crea un selector memoizado para un efecto específico.
 *
 * @example
 * const selectEffect = useMemo(() => makeSelectEffectById(effectId), [effectId]);
 * const effect = useAppSelector(selectEffect);
 */
export const makeSelectEffectById = (effectId: string) =>
  createSelector(
    [selectEffectsById],
    (byId): Effect | null => byId[effectId] ?? null
  );

/**
 * Crea un selector memoizado para efectos de una track (ordenados por position).
 *
 * @example
 * const selectEffects = useMemo(() => makeSelectEffectsByTrackId(trackId), [trackId]);
 * const effects = useAppSelector(selectEffects);
 */
export const makeSelectEffectsByTrackId = (trackId: string) =>
  createSelector(
    [selectEffectsById, selectEffectsAllIds],
    (byId, allIds): Effect[] =>
      allIds
        .reduce<Effect[]>((acc, id) => {
          const effect = byId[id];
          if (effect && effect.trackId === trackId) acc.push(effect);
          return acc;
        }, [])
        .sort(byPosition)
  );

/**
 * Crea un selector para saber si un efecto está bypaseado.
 *
 * @example
 * const selectBypassed = useMemo(() => makeSelectIsEffectBypassed(effectId), [effectId]);
 * const isBypassed = useAppSelector(selectBypassed);
 */
export const makeSelectIsEffectBypassed = (effectId: string) =>
  createSelector(
    [selectEffectsById],
    (byId): boolean => byId[effectId]?.bypassed ?? false
  );