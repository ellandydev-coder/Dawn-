/**
 * trackSelectors.ts
 * -----------------
 * Selectores memoizados para el slice de tracks.
 *
 * Convenciones:
 * - Selectores base (sin createSelector): acceso directo, O(1)
 * - Selectores derivados (createSelector): memoizados, se recalculan
 *   solo cuando cambian sus inputs
 * - Fábricas (makeSelect*): crean un selector por instancia,
 *   útil para componentes que renderizan por trackId
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@state/store';
import type { Track } from '@domain/models/Track';

// ═══════════════════════════════════════════════════════════════
// 🎯 FALLBACKS ESTABLES
//
// Usar ?? [] en un createSelector crea una nueva referencia de
// array en cada evaluación cuando el valor es undefined/null.
// Eso rompe la memoización de reselect y dispara el warning:
//   "Selector returned a different result with the same parameters"
//
// Solución: un objeto congelado con referencia estable.
// Object.freeze impide mutación accidental y deja claro que
// este array nunca debe modificarse.
// ═══════════════════════════════════════════════════════════════

const EMPTY_STRING_ARRAY: readonly string[] = Object.freeze([]);

// ═══════════════════════════════════════════════════════════════
// Selectores base (O(1), sin memoización)
// ═══════════════════════════════════════════════════════════════

export const selectTracksById = (state: RootState) => state.tracks.byId;
export const selectTrackAllIds = (state: RootState) => state.tracks.allIds;
export const selectSelectedTrackId = (state: RootState) =>
  state.tracks.selectedTrackId;

/** Selector atómico por id — para uso directo en useAppSelector */
export const selectTrackById = (
  state: RootState,
  trackId: string
): Track | null => state.tracks.byId[trackId] ?? null;

// ═══════════════════════════════════════════════════════════════
// Selectores derivados (memoizados)
// ═══════════════════════════════════════════════════════════════

/** Lista ordenada de tracks completos (según allIds) */
export const selectAllTracks = createSelector(
  [selectTracksById, selectTrackAllIds],
  (byId, allIds): Track[] =>
    allIds.reduce<Track[]>((acc, id) => {
      const track = byId[id];
      if (track) acc.push(track);
      return acc;
    }, [])
);

/** Cantidad total de tracks */
export const selectTracksCount = createSelector(
  [selectTrackAllIds],
  (ids): number => ids.length
);

/** true si hay al menos una track */
export const selectHasTracks = createSelector(
  [selectTrackAllIds],
  (ids): boolean => ids.length > 0
);

/** Track actualmente seleccionada (o null) */
export const selectSelectedTrack = createSelector(
  [selectTracksById, selectSelectedTrackId],
  (byId, selectedId): Track | null =>
    selectedId ? (byId[selectedId] ?? null) : null
);

/** true si hay algún track seleccionado */
export const selectHasSelectedTrack = createSelector(
  [selectSelectedTrackId],
  (id): boolean => id !== null
);

// ═══════════════════════════════════════════════════════════════
// Selectores de estado de audio (mute / solo / arm)
// ═══════════════════════════════════════════════════════════════

/** true si alguna track tiene solo activo */
export const selectAnySoloed = createSelector(
  [selectTracksById, selectTrackAllIds],
  (byId, allIds): boolean => allIds.some((id) => byId[id]?.soloed === true)
);

/** true si alguna track tiene mute activo */
export const selectAnyMuted = createSelector(
  [selectTracksById, selectTrackAllIds],
  (byId, allIds): boolean => allIds.some((id) => byId[id]?.muted === true)
);

/** true si alguna track está armada para grabación */
export const selectAnyArmed = createSelector(
  [selectTracksById, selectTrackAllIds],
  (byId, allIds): boolean => allIds.some((id) => byId[id]?.armed === true)
);

/** IDs de tracks en solo */
export const selectSoloedTrackIds = createSelector(
  [selectTracksById, selectTrackAllIds],
  (byId, allIds): string[] =>
    allIds.filter((id) => byId[id]?.soloed === true)
);

/** IDs de tracks muteadas */
export const selectMutedTrackIds = createSelector(
  [selectTracksById, selectTrackAllIds],
  (byId, allIds): string[] =>
    allIds.filter((id) => byId[id]?.muted === true)
);

/** IDs de tracks armadas */
export const selectArmedTrackIds = createSelector(
  [selectTracksById, selectTrackAllIds],
  (byId, allIds): string[] =>
    allIds.filter((id) => byId[id]?.armed === true)
);

// ═══════════════════════════════════════════════════════════════
// Selectores por tipo de track
// ═══════════════════════════════════════════════════════════════

/** Tracks filtradas por tipo */
export const selectTracksByType = createSelector(
  [selectAllTracks, (_: RootState, type: string) => type],
  (tracks, type): Track[] => tracks.filter((t) => t.type === type)
);

/** IDs de tracks de un tipo específico */
export const selectTrackIdsByType = createSelector(
  [selectTracksById, selectTrackAllIds, (_: RootState, type: string) => type],
  (byId, allIds, type): string[] =>
    allIds.filter((id) => byId[id]?.type === type)
);

// ═══════════════════════════════════════════════════════════════
// Selectores de clips por track
// ═══════════════════════════════════════════════════════════════

/**
 * IDs de clips de una track específica.
 *
 * FIX: antes usaba `?? []` que crea una nueva referencia de array
 * cada vez que clipIds es undefined → rompía la memoización de
 * reselect y disparaba el warning de Redux.
 *
 * Ahora usa EMPTY_STRING_ARRAY (Object.freeze) → referencia estable
 * garantizada cuando la track no existe o no tiene clips.
 */
export const selectClipIdsByTrackId = createSelector(
  [selectTracksById, (_: RootState, trackId: string) => trackId],
  (byId, trackId): readonly string[] =>
    byId[trackId]?.clipIds ?? EMPTY_STRING_ARRAY
);

/** true si la track tiene al menos un clip */
export const selectTrackHasClips = createSelector(
  [selectTracksById, (_: RootState, trackId: string) => trackId],
  (byId, trackId): boolean => (byId[trackId]?.clipIds.length ?? 0) > 0
);

// ═══════════════════════════════════════════════════════════════
// Selectores de routing
// ═══════════════════════════════════════════════════════════════

/** Output track ID de una track específica */
export const selectTrackOutputId = createSelector(
  [selectTracksById, (_: RootState, trackId: string) => trackId],
  (byId, trackId): string | null => byId[trackId]?.outputTrackId ?? null
);

/**
 * IDs de tracks que envían su output a un track específico.
 *
 * FIX: mismo patrón — si no hay hijos, devuelve EMPTY_STRING_ARRAY
 * en lugar de un [] nuevo en cada evaluación.
 */
export const selectTrackChildIds = createSelector(
  [
    selectTracksById,
    selectTrackAllIds,
    (_: RootState, parentId: string) => parentId,
  ],
  (byId, allIds, parentId): readonly string[] => {
    const children = allIds.filter(
      (id) => byId[id]?.outputTrackId === parentId
    );
    return children.length > 0 ? children : EMPTY_STRING_ARRAY;
  }
);

// ═══════════════════════════════════════════════════════════════
// Fábricas de selectores (por instancia)
//
// Se crean con useMemo() en el componente para que cada instancia
// tenga su propio caché de memoización independiente.
// ═══════════════════════════════════════════════════════════════

/**
 * Crea un selector memoizado para una track específica.
 * El componente solo re-renderiza si cambia ESA track concreta.
 *
 * @example
 * const selectTrack = useMemo(() => makeSelectTrackById(trackId), [trackId]);
 * const track = useAppSelector(selectTrack);
 */
export const makeSelectTrackById = (trackId: string) =>
  createSelector(
    [selectTracksById],
    (byId): Track | null => byId[trackId] ?? null
  );

/**
 * Crea un selector que retorna si una track está seleccionada.
 *
 * @example
 * const selectIsSelected = useMemo(() => makeSelectIsTrackSelected(trackId), [trackId]);
 * const isSelected = useAppSelector(selectIsSelected);
 */
export const makeSelectIsTrackSelected = (trackId: string) =>
  createSelector(
    [selectSelectedTrackId],
    (selectedId): boolean => selectedId === trackId
  );

/**
 * Crea un selector memoizado para los clipIds de una track.
 * Preferible a selectClipIdsByTrackId cuando se usa en un componente
 * que se monta con un trackId fijo — evita que reselect comparta
 * caché entre múltiples instancias con distinto trackId.
 *
 * @example
 * const selectClipIds = useMemo(() => makeSelectClipIdsByTrackId(trackId), [trackId]);
 * const clipIds = useAppSelector(selectClipIds);
 */
export const makeSelectClipIdsByTrackId = (trackId: string) =>
  createSelector(
    [selectTracksById],
    (byId): readonly string[] =>
      byId[trackId]?.clipIds ?? EMPTY_STRING_ARRAY
  );