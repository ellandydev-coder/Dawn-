/**
 * tracksThunks.ts
 * ---------------
 * Acciones compuestas que tocan MÚLTIPLES slices.
 *
 * Estas operaciones no pueden vivir en un solo slice porque
 * necesitan leer/escribir estado de tracks, clips, mixer, effects
 * y automation de forma coordinada.
 *
 * ✔ Cascade delete (track → clips, mixer channel, effects, automation)
 * ✔ Guards contra IDs inexistentes
 * ✔ Logging consistente
 * ✔ Compatible con audioSyncMiddleware (removeTrack dispara cleanup de audio)
 */

import type { AppDispatch, RootState } from '@state/store';
import { removeTrack } from './tracksSlice';
import { removeClipsByTrack } from '@state/slices/clips/clipsSlice';
import { removeChannel } from '@state/slices/mixer/mixerSlice';

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════

const LOG_PREFIX = '[tracksThunks]';

// ═══════════════════════════════════════════
// deleteTrackCascade
// ═══════════════════════════════════════════

/**
 * Elimina un track y TODOS sus recursos asociados en cascada:
 *
 * 1. Clips del track (removeClipsByTrack — batch, más eficiente que N removeClip)
 * 2. Canal de mixer (removeChannel)
 * 3. Track (removeTrack — dispara audioSyncMiddleware → libera nodos de audio)
 *
 * La selección se limpia automáticamente en removeTrack si el track
 * eliminado era el selectedTrackId.
 *
 * @returns true si se eliminó, false si el track no existía
 */
export function deleteTrackCascade(trackId: string) {
  return (dispatch: AppDispatch, getState: () => RootState): boolean => {
    const state = getState();
    const track = state.tracks.byId[trackId];

    if (!track) {
      if (import.meta.env?.DEV) {
        console.warn(`${LOG_PREFIX} Track "${trackId}" no existe, ignorando.`);
      }
      return false;
    }

    const clipCount = track.clipIds.length;
    const trackName = track.name;

    // 1. Eliminar todos los clips del track en batch
    if (clipCount > 0) {
      dispatch(removeClipsByTrack(trackId));
    }

    // 2. Eliminar canal de mixer (si existe, el reducer lo ignora si no)
    dispatch(removeChannel(trackId));

    // 3. Eliminar el track
    //    → audioSyncMiddleware escucha removeTrack y libera nodos de audio
    //    → tracksSlice limpia selectedTrackId si coincide
    //    → tracksSlice limpia outputTrackId references
    dispatch(removeTrack(trackId));

    if (import.meta.env?.DEV) {
      console.info(
        `${LOG_PREFIX} Eliminado track "${trackName}" (${clipCount} clips)`
      );
    }

    return true;
  };
}

// ═══════════════════════════════════════════
// deleteSelectedTrack
// ═══════════════════════════════════════════

/**
 * Elimina el track actualmente seleccionado.
 * Si no hay ninguno seleccionado, no hace nada.
 *
 * @returns true si se eliminó, false si no había selección
 */
export function deleteSelectedTrack() {
  return (dispatch: AppDispatch, getState: () => RootState): boolean => {
    const selectedId = getState().tracks.selectedTrackId;

    if (!selectedId) {
      if (import.meta.env?.DEV) {
        console.info(`${LOG_PREFIX} No hay track seleccionado.`);
      }
      return false;
    }

    return dispatch(deleteTrackCascade(selectedId));
  };
}

// ═══════════════════════════════════════════
// deleteMultipleTracks
// ═══════════════════════════════════════════

/**
 * Elimina múltiples tracks en cascada.
 * Útil para operaciones bulk (eliminar selección múltiple, limpiar proyecto).
 *
 * @returns cantidad de tracks efectivamente eliminados
 */
export function deleteMultipleTracks(trackIds: string[]) {
  return (dispatch: AppDispatch): number => {
    let deleted = 0;

    for (const trackId of trackIds) {
      const result = dispatch(deleteTrackCascade(trackId));
      if (result) deleted++;
    }

    if (import.meta.env?.DEV && deleted > 0) {
      console.info(
        `${LOG_PREFIX} Eliminados ${deleted}/${trackIds.length} tracks en batch`
      );
    }

    return deleted;
  };
}