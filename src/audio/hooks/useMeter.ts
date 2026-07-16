// src/audio/hooks/useMeter.ts

import { useCallback, useRef, useSyncExternalStore } from 'react';
import { MeterManager, type MeterData } from '@audio/metering/MeterManager';

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════

const CHANGE_THRESHOLD = 0.01;

const DEFAULT_METER_DATA: MeterData = {
  peak: 0,
  rms: 0,
  peakHold: 0,
  clipping: false,
};

// ═══════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════

/**
 * useMeter
 * --------
 * Hook para consumir datos de metering en tiempo real.
 *
 * ⚠️ NO usa Redux. Se suscribe directamente al MeterManager
 * para conseguir 60 FPS sin colapsar el store.
 *
 * Solo re-renderiza cuando algún valor cambia más de 1%
 * o cuando cambia el estado de clipping.
 *
 * @param id - trackId, "master", o null/undefined (inactivo → devuelve default)
 */
export function useMeter(id: string | null | undefined): MeterData {
  // Cache del último snapshot que devolvimos.
  // useSyncExternalStore exige ref-equality entre snapshots iguales.
  const cachedSnapshotRef = useRef<MeterData>(DEFAULT_METER_DATA);

  // ─── subscribe ───────────────────────────────────────────
  const subscribe = useCallback(
    (notify: () => void) => {
      if (!id) return () => {};

      return MeterManager.subscribe(id, (newData) => {
        const last = cachedSnapshotRef.current;

        const changed =
          newData.clipping !== last.clipping ||
          Math.abs(newData.rms - last.rms) > CHANGE_THRESHOLD ||
          Math.abs(newData.peak - last.peak) > CHANGE_THRESHOLD ||
          Math.abs(newData.peakHold - last.peakHold) > CHANGE_THRESHOLD;

        if (changed) {
          cachedSnapshotRef.current = newData;
          notify();
        }
      });
    },
    [id]
  );

  // ─── getSnapshot ─────────────────────────────────────────
  // Al cambiar el id, resetear el cache al default.
  const getSnapshot = useCallback((): MeterData => {
    if (!id) {
      cachedSnapshotRef.current = DEFAULT_METER_DATA;
      return DEFAULT_METER_DATA;
    }
    return cachedSnapshotRef.current;
  }, [id]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}