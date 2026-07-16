/**
 * clipSelectors.ts
 * ----------------
 * Selectores memoizados para el slice de clips.
 *
 * Convenciones:
 * - Selectores base: O(1), sin memoización
 * - Selectores derivados: createSelector, se recalculan solo cuando cambian inputs
 * - Fábricas (makeSelect*): crean un selector por instancia
 */

import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@state/store';
import type { Clip, ClipType } from '@domain/models/Clip';

// ═══════════════════════════════════════════
// Selectores base (O(1), sin memoización)
// ═══════════════════════════════════════════

export const selectClipsById = (state: RootState) => state.clips.byId;
export const selectClipAllIds = (state: RootState) => state.clips.allIds;
export const selectSelectedClipIds = (state: RootState) =>
  state.clips.selectedClipIds;

/** Selector atómico por id — para uso directo en useAppSelector */
export const selectClipById = (state: RootState, clipId: string): Clip | null =>
  state.clips.byId[clipId] ?? null;

// ═══════════════════════════════════════════
// Selectores derivados (memoizados)
// ═══════════════════════════════════════════

/** Lista ordenada de todos los clips */
export const selectAllClips = createSelector(
  [selectClipsById, selectClipAllIds],
  (byId, allIds): Clip[] =>
    allIds.reduce<Clip[]>((acc, id) => {
      const clip = byId[id];
      if (clip) acc.push(clip);
      return acc;
    }, [])
);

/** Cantidad total de clips */
export const selectClipsCount = createSelector(
  [selectClipAllIds],
  (ids): number => ids.length
);

/** true si hay al menos un clip */
export const selectHasClips = createSelector(
  [selectClipAllIds],
  (ids): boolean => ids.length > 0
);

// ═══════════════════════════════════════════
// Selectores de selección
// ═══════════════════════════════════════════

/** Clips seleccionados (objetos completos) */
export const selectSelectedClips = createSelector(
  [selectClipsById, selectSelectedClipIds],
  (byId, selectedIds): Clip[] =>
    selectedIds.reduce<Clip[]>((acc, id) => {
      const clip = byId[id];
      if (clip) acc.push(clip);
      return acc;
    }, [])
);

/** true si hay al menos un clip seleccionado */
export const selectHasSelectedClips = createSelector(
  [selectSelectedClipIds],
  (ids): boolean => ids.length > 0
);

/** Cantidad de clips seleccionados */
export const selectSelectedClipsCount = createSelector(
  [selectSelectedClipIds],
  (ids): number => ids.length
);

/** true si un clip específico está seleccionado */
export const selectIsClipSelected = (state: RootState, clipId: string): boolean =>
  state.clips.selectedClipIds.includes(clipId);

// ═══════════════════════════════════════════
// Selectores por track
// ═══════════════════════════════════════════

/** Clips que pertenecen a una track específica */
export const selectClipsByTrackId = createSelector(
  [selectClipsById, selectClipAllIds, (_: RootState, trackId: string) => trackId],
  (byId, allIds, trackId): Clip[] =>
    allIds.reduce<Clip[]>((acc, id) => {
      const clip = byId[id];
      if (clip && clip.trackId === trackId) acc.push(clip);
      return acc;
    }, [])
);

/** IDs de clips que pertenecen a una track específica */
export const selectClipIdsByTrackId = createSelector(
  [selectClipsById, selectClipAllIds, (_: RootState, trackId: string) => trackId],
  (byId, allIds, trackId): string[] =>
    allIds.filter((id) => byId[id]?.trackId === trackId)
);

/** Cantidad de clips en una track */
export const selectClipsCountByTrackId = createSelector(
  [selectClipIdsByTrackId],
  (ids): number => ids.length
);

// ═══════════════════════════════════════════
// Selectores por tipo
// ═══════════════════════════════════════════

/** Clips filtrados por tipo (audio, midi, etc.) */
export const selectClipsByType = createSelector(
  [selectClipsById, selectClipAllIds, (_: RootState, type: ClipType) => type],
  (byId, allIds, type): Clip[] =>
    allIds.reduce<Clip[]>((acc, id) => {
      const clip = byId[id];
      if (clip && clip.type === type) acc.push(clip);
      return acc;
    }, [])
);

// ═══════════════════════════════════════════
// Selectores espaciales (timeline)
// ═══════════════════════════════════════════

/**
 * Clips que se solapan con un rango de tiempo [start, end].
 * Un clip se solapa si:
 *   clip.startTime < end && clip.startTime + clip.duration > start
 *
 * Útil para:
 * - Renderizar solo clips visibles en el viewport
 * - Detectar colisiones al mover/crear clips
 * - Scheduling de audio (qué clips suenan en un rango)
 */
export const selectClipsInTimeRange = createSelector(
  [
    selectClipsById,
    selectClipAllIds,
    (_: RootState, range: { start: number; end: number }) => range,
  ],
  (byId, allIds, { start, end }): Clip[] => {
    if (start >= end) return [];

    return allIds.reduce<Clip[]>((acc, id) => {
      const clip = byId[id];
      if (
        clip &&
        clip.startTime < end &&
        clip.startTime + clip.duration > start
      ) {
        acc.push(clip);
      }
      return acc;
    }, []);
  }
);

/**
 * Clips de una track específica que se solapan con un rango de tiempo.
 * Combinación de filtrado por track + rango temporal.
 */
export const selectTrackClipsInTimeRange = createSelector(
  [
    selectClipsById,
    selectClipAllIds,
    (_: RootState, params: { trackId: string; start: number; end: number }) => params,
  ],
  (byId, allIds, { trackId, start, end }): Clip[] => {
    if (start >= end) return [];

    return allIds.reduce<Clip[]>((acc, id) => {
      const clip = byId[id];
      if (
        clip &&
        clip.trackId === trackId &&
        clip.startTime < end &&
        clip.startTime + clip.duration > start
      ) {
        acc.push(clip);
      }
      return acc;
    }, []);
  }
);

/**
 * Tiempo del final del último clip (útil para saber la "duración del proyecto").
 * Retorna 0 si no hay clips.
 */
export const selectLastClipEndTime = createSelector(
  [selectClipsById, selectClipAllIds],
  (byId, allIds): number => {
    let maxEnd = 0;

    for (const id of allIds) {
      const clip = byId[id];
      if (clip) {
        const clipEnd = clip.startTime + clip.duration;
        if (clipEnd > maxEnd) maxEnd = clipEnd;
      }
    }

    return maxEnd;
  }
);

// ═══════════════════════════════════════════
// Selectores de assets
// ═══════════════════════════════════════════

/** Clips que usan un asset específico */
export const selectClipsByAssetId = createSelector(
  [selectClipsById, selectClipAllIds, (_: RootState, assetId: string) => assetId],
  (byId, allIds, assetId): Clip[] =>
    allIds.reduce<Clip[]>((acc, id) => {
      const clip = byId[id];
      if (clip && clip.assetId === assetId) acc.push(clip);
      return acc;
    }, [])
);

/** IDs de assets únicos usados por clips actuales */
export const selectUsedAssetIds = createSelector(
  [selectClipsById, selectClipAllIds],
  (byId, allIds): string[] => {
    const assetIds = new Set<string>();

    for (const id of allIds) {
      const assetId = byId[id]?.assetId;
      if (assetId) assetIds.add(assetId);
    }

    return Array.from(assetIds);
  }
);

// ═══════════════════════════════════════════
// Fábricas de selectores (por instancia)
// ═══════════════════════════════════════════

/**
 * Crea un selector memoizado para un clip específico.
 *
 * @example
 * const selectClip = useMemo(() => makeSelectClipById(clipId), [clipId]);
 * const clip = useAppSelector(selectClip);
 */
export const makeSelectClipById = (clipId: string) =>
  createSelector(
    [selectClipsById],
    (byId): Clip | null => byId[clipId] ?? null
  );

/**
 * Crea un selector memoizado para clips de una track.
 *
 * @example
 * const selectTrackClips = useMemo(() => makeSelectClipsByTrackId(trackId), [trackId]);
 * const clips = useAppSelector(selectTrackClips);
 */
export const makeSelectClipsByTrackId = (trackId: string) =>
  createSelector(
    [selectClipsById, selectClipAllIds],
    (byId, allIds): Clip[] =>
      allIds.reduce<Clip[]>((acc, id) => {
        const clip = byId[id];
        if (clip && clip.trackId === trackId) acc.push(clip);
        return acc;
      }, [])
  );

/**
 * Crea un selector que retorna si un clip está seleccionado.
 *
 * @example
 * const selectIsSelected = useMemo(() => makeSelectIsClipSelected(clipId), [clipId]);
 * const isSelected = useAppSelector(selectIsSelected);
 */
export const makeSelectIsClipSelected = (clipId: string) =>
  createSelector(
    [selectSelectedClipIds],
    (selectedIds): boolean => selectedIds.includes(clipId)
  );