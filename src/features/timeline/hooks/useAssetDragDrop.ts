// src/features/timeline/hooks/useAssetDragDrop.ts

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import { addAsset } from '@state/slices/assets/assetsSlice';
import { addClip } from '@state/slices/clips/clipsSlice';
import { addTrack, addClipIdToTrack } from '@state/slices/tracks/tracksSlice';
import { FileImportService } from '@services/file-io/FileImportService';
import {
  getDraggedAssetId,
  clearDraggedAssetId,
} from '@shared/utils/dragState';
import type { Asset } from '@domain/models/Asset';
import type { AssetPreviewState } from '../components/TrackLane';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface UseAssetDragDropParams {
  bpm: number;
  trackIds: string[];
  /** Segundos actuales del edit cursor — usado como posición de drop */
  editCursorSeconds: number;
  lanesScrollRef: React.RefObject<HTMLDivElement | null>;
  headersScrollRef: React.RefObject<HTMLDivElement | null>;
  pxToSeconds: (px: number, bpm: number) => number;
  snapToBeat: (seconds: number, bpm: number, disableSnap?: boolean) => number;
  getTrackColor: (index: number) => string;
}

/**
 * Estado visual del hover sobre la columna de headers.
 * - kind: 'track' → el usuario está sobre un TrackHeader existente
 * - kind: 'new'   → está sobre el slot "+" o el hueco vacío
 * - null          → no está sobre la columna
 */
export type HeaderDropTarget =
  | { kind: 'track'; trackId: string }
  | { kind: 'new' }
  | null;

export interface UseAssetDragDropReturn {
  assetPreview: AssetPreviewState | null;
  isDraggingAsset: boolean;
  isImportingFiles: boolean;
  headerDropTarget: HeaderDropTarget;
  handleLaneDragOver: (e: React.DragEvent, trackId: string) => void;
  handleLaneDrop: (e: React.DragEvent, trackId: string) => void;
  setAssetPreview: React.Dispatch<React.SetStateAction<AssetPreviewState | null>>;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 DEV LOGGING
// ═══════════════════════════════════════════════════════════════

const IS_DEV = import.meta.env.DEV;

function warnDev(message: string): void {
  if (IS_DEV) console.warn(`[useAssetDragDrop] ${message}`);
}

function logDev(message: string, ...args: unknown[]): void {
  if (IS_DEV) console.log(`[useAssetDragDrop] ${message}`, ...args);
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS DE DOM
// ═══════════════════════════════════════════════════════════════

/**
 * A partir del target de un DragEvent, determina si estamos sobre
 * un TrackHeader existente (y cuál) o sobre el slot "añadir pista".
 */
function resolveHeaderTarget(target: EventTarget | null): HeaderDropTarget {
  if (!(target instanceof Element)) return null;

  // 1) ¿Estamos dentro de un TrackHeader?
  const trackEl = target.closest<HTMLElement>('[data-track-id]');
  if (trackEl?.dataset.trackId) {
    return { kind: 'track', trackId: trackEl.dataset.trackId };
  }

  // 2) ¿Sobre el slot "+" o el hueco vacío de la columna?
  //    Cualquier drop dentro de .ws-headers-col que no sea un
  //    TrackHeader se considera "crear nueva pista".
  if (target.closest('.ws-headers-col')) {
    return { kind: 'new' };
  }

  return null;
}

/**
 * Detecta si el DragEvent trae archivos externos del OS
 * (arrastrados desde el explorador de archivos).
 */
function isExternalFileDrag(e: DragEvent): boolean {
  return e.dataTransfer?.types.includes('Files') ?? false;
}

// ═══════════════════════════════════════════════════════════════
// 🔑 HOOK
//
// Arquitectura de captura del assetId (drag interno)
// ──────────────────────────────────────────────────
// La HTML5 DnD spec prohíbe leer dataTransfer.getData() fuera del
// evento dragstart. Solución: singleton `dragState` que el drag
// source (Sidebar/AssetItem) escribe en dragstart y el drop target
// lee cuando lo necesita.
//
// Soporte de drag externo (archivos del OS)
// ─────────────────────────────────────────
// Además del drag interno, el hook detecta cuando el usuario
// arrastra archivos directamente desde el explorador del sistema
// (`dataTransfer.types` incluye `'Files'`). En ese caso importa
// los archivos vía FileImportService y crea automáticamente
// tracks + clips según el target del drop:
//
//   • Drop sobre TrackHeader → clips en esa pista, apilados
//     secuencialmente desde editCursorSeconds
//   • Drop sobre slot "+" / hueco vacío → un track nuevo por
//     cada archivo importado, cada uno con su clip en editCursor
//   • Drop sobre lane existente → clips en esa lane desde donde
//     se soltó el ratón (respetando snap)
// ═══════════════════════════════════════════════════════════════

export function useAssetDragDrop({
  bpm,
  trackIds,
  editCursorSeconds,
  lanesScrollRef,
  headersScrollRef,
  pxToSeconds,
  snapToBeat,
  getTrackColor,
}: UseAssetDragDropParams): UseAssetDragDropReturn {
  const dispatch   = useAppDispatch();
  const assetsById = useAppSelector((s) => s.assets.byId);
  const tracksById = useAppSelector((s) => s.tracks.byId);

  const [assetPreview,     setAssetPreview]     = useState<AssetPreviewState | null>(null);
  const [isDraggingAsset,  setIsDraggingAsset]  = useState(false);
  const [isImportingFiles, setIsImportingFiles] = useState(false);
  const [headerDropTarget, setHeaderDropTarget] = useState<HeaderDropTarget>(null);

  // ─── Contadores de dragenter/dragleave anidados ────────────
  const lanesEnterCountRef   = useRef(0);
  const headersEnterCountRef = useRef(0);

  // ─── Refs frescos para listeners nativos ───────────────────
  const bpmRef            = useRef(bpm);
  const trackIdsRef       = useRef(trackIds);
  const editCursorRef     = useRef(editCursorSeconds);
  const assetsByIdRef     = useRef(assetsById);
  const tracksByIdRef     = useRef(tracksById);
  const pxToSecondsRef    = useRef(pxToSeconds);
  const snapToBeatRef     = useRef(snapToBeat);
  const getTrackColorRef  = useRef(getTrackColor);

  useEffect(() => { bpmRef.current           = bpm;               }, [bpm]);
  useEffect(() => { trackIdsRef.current      = trackIds;          }, [trackIds]);
  useEffect(() => { editCursorRef.current    = editCursorSeconds; }, [editCursorSeconds]);
  useEffect(() => { assetsByIdRef.current    = assetsById;        }, [assetsById]);
  useEffect(() => { tracksByIdRef.current    = tracksById;        }, [tracksById]);
  useEffect(() => { pxToSecondsRef.current   = pxToSeconds;       }, [pxToSeconds]);
  useEffect(() => { snapToBeatRef.current    = snapToBeat;        }, [snapToBeat]);
  useEffect(() => { getTrackColorRef.current = getTrackColor;     }, [getTrackColor]);

  // ─── Helper: leer asset actual del singleton ────────────────
  const getDraggedAsset = useCallback(() => {
    const id = getDraggedAssetId();
    if (!id) return null;
    const asset = assetsByIdRef.current[id];
    return asset ? { id, asset } : null;
  }, []);

  // ─── Reset de estado visual ────────────────────────────────
  const resetDragUI = useCallback(() => {
    lanesEnterCountRef.current   = 0;
    headersEnterCountRef.current = 0;
    setAssetPreview(null);
    setIsDraggingAsset(false);
    setHeaderDropTarget(null);
  }, []);

  // ═══════════════════════════════════════════════════════════
  // 🆕 HELPERS DE CREACIÓN
  // ═══════════════════════════════════════════════════════════

  /** Crea un clip en una pista existente y lo enlaza al track. */
  const addClipToTrack = useCallback(
    (trackId: string, asset: Asset, startTime: number) => {
      const clipAction = addClip({
        trackId,
        type:     'audio',
        name:     asset.name,
        startTime,
        duration: asset.duration,
        assetId:  asset.id,
      });
      dispatch(clipAction);
      dispatch(addClipIdToTrack({
        trackId,
        clipId: clipAction.payload.id,
      }));
    },
    [dispatch]
  );

  /** Crea una pista nueva + clip en startTime. Retorna el nuevo trackId. */
  const createTrackWithClip = useCallback(
    (asset: Asset, startTime: number): string => {
      const idx = trackIdsRef.current.length;
      const trackAction = addTrack({
        name:  asset.name || `Track ${idx + 1}`,
        type:  'audio',
        color: getTrackColorRef.current(idx),
      });
      dispatch(trackAction);
      const newTrackId = trackAction.payload.id;
      addClipToTrack(newTrackId, asset, startTime);
      return newTrackId;
    },
    [dispatch, addClipToTrack]
  );

  /**
   * Importa archivos externos del OS, los registra en el store
   * y devuelve los Assets ya listos para crear clips.
   */
  const importExternalFiles = useCallback(
    async (files: FileList | File[]): Promise<Asset[]> => {
      setIsImportingFiles(true);
      try {
        const imported = await FileImportService.importFiles(files);
        for (const asset of imported) {
          dispatch(addAsset(asset));
        }
        logDev(`Importados ${imported.length}/${Array.from(files).length} archivos`);
        return imported;
      } catch (err) {
        console.error('[useAssetDragDrop] Error importando archivos:', err);
        return [];
      } finally {
        setIsImportingFiles(false);
      }
    },
    [dispatch]
  );

  // ═══════════════════════════════════════════════════════════
  // 1️⃣ LIMPIEZA GLOBAL EN DRAGEND
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const onGlobalDragEnd = () => {
      resetDragUI();
    };

    window.addEventListener('dragend', onGlobalDragEnd, true);

    return () => {
      window.removeEventListener('dragend', onGlobalDragEnd, true);
    };
  }, [resetDragUI]);

  // ═══════════════════════════════════════════════════════════
  // 2️⃣ LISTENERS NATIVOS EN EL CONTENEDOR DE LANES
  //
  // Acepta drag interno (asset del sidebar) Y externo (archivos
  // del OS). Los handlers React por lane siguen manejando el
  // asset preview posicional del drag interno.
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const lanesScroll = lanesScrollRef.current;
    if (!lanesScroll) return;

    const isAcceptable = (e: DragEvent) =>
      getDraggedAsset() !== null || isExternalFileDrag(e);

    const onLanesEnter = (e: DragEvent) => {
      if (!isAcceptable(e)) return;
      e.preventDefault();
      lanesEnterCountRef.current += 1;
      if (lanesEnterCountRef.current === 1) {
        setIsDraggingAsset(true);
      }
    };

    const onLanesOver = (e: DragEvent) => {
      if (!isAcceptable(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };

    const onLanesLeave = (e: DragEvent) => {
      if (!isAcceptable(e)) return;
      lanesEnterCountRef.current = Math.max(0, lanesEnterCountRef.current - 1);
      if (lanesEnterCountRef.current === 0) {
        setAssetPreview(null);
        setIsDraggingAsset(false);
      }
    };

    lanesScroll.addEventListener('dragenter', onLanesEnter);
    lanesScroll.addEventListener('dragover',  onLanesOver);
    lanesScroll.addEventListener('dragleave', onLanesLeave);

    return () => {
      lanesScroll.removeEventListener('dragenter', onLanesEnter);
      lanesScroll.removeEventListener('dragover',  onLanesOver);
      lanesScroll.removeEventListener('dragleave', onLanesLeave);
    };
  }, [lanesScrollRef, getDraggedAsset]);

  // ═══════════════════════════════════════════════════════════
  // 3️⃣ LISTENERS NATIVOS EN LA COLUMNA DE HEADERS
  //
  // Soporta dos flujos:
  //   A) Drag interno (asset del Sidebar): usa dragState + editCursor
  //   B) Drag externo (archivos del OS): usa FileImportService async
  //
  // En ambos casos:
  //   • Drop sobre TrackHeader → añade clip(s) a esa pista
  //   • Drop sobre slot "+" / hueco vacío → crea pista(s) nueva(s)
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const headersEl = headersScrollRef.current;
    if (!headersEl) return;

    const isAcceptable = (e: DragEvent) =>
      getDraggedAsset() !== null || isExternalFileDrag(e);

    const onHeadersEnter = (e: DragEvent) => {
      if (!isAcceptable(e)) return;
      e.preventDefault();
      headersEnterCountRef.current += 1;
      if (headersEnterCountRef.current === 1) {
        setIsDraggingAsset(true);
      }
    };

    const onHeadersOver = (e: DragEvent) => {
      if (!isAcceptable(e)) return;

      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';

      const target = resolveHeaderTarget(e.target);

      // Solo actualizamos el estado si realmente cambia (evita re-renders)
      setHeaderDropTarget((prev) => {
        if (target === null && prev === null) return prev;
        if (
          target?.kind === 'track' &&
          prev?.kind === 'track' &&
          target.trackId === prev.trackId
        ) return prev;
        if (target?.kind === 'new' && prev?.kind === 'new') return prev;
        return target;
      });
    };

    const onHeadersLeave = (e: DragEvent) => {
      if (!isAcceptable(e)) return;
      headersEnterCountRef.current = Math.max(0, headersEnterCountRef.current - 1);
      if (headersEnterCountRef.current === 0) {
        setHeaderDropTarget(null);
      }
    };

    const onHeadersDrop = (e: DragEvent) => {
      // Prevención SIEMPRE primero (evita que el navegador abra el archivo)
      e.preventDefault();
      e.stopPropagation();

      const target = resolveHeaderTarget(e.target);
      if (!target) {
        resetDragUI();
        return;
      }

      const startTime = Math.max(0, editCursorRef.current);

      // ─── Caso A: Drag externo (archivos del OS) ──────────
      if (isExternalFileDrag(e)) {
        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) {
          resetDragUI();
          return;
        }

        // Snapshot antes de resetear
        const filesSnapshot = Array.from(files);
        resetDragUI();

        void (async () => {
          const assets = await importExternalFiles(filesSnapshot);
          if (assets.length === 0) return;

          if (target.kind === 'track') {
            // Apilar clips consecutivamente en la misma pista
            let cursor = startTime;
            for (const asset of assets) {
              addClipToTrack(target.trackId, asset, cursor);
              cursor += asset.duration;
            }
          } else {
            // Un track nuevo por cada archivo importado
            for (const asset of assets) {
              createTrackWithClip(asset, startTime);
            }
          }
        })();
        return;
      }

      // ─── Caso B: Drag interno (asset del Sidebar) ────────
      const info = getDraggedAsset();
      if (!info) {
        resetDragUI();
        return;
      }

      const { asset } = info;
      clearDraggedAssetId();
      resetDragUI();

      if (target.kind === 'track') {
        addClipToTrack(target.trackId, asset, startTime);
      } else {
        createTrackWithClip(asset, startTime);
      }
    };

    headersEl.addEventListener('dragenter', onHeadersEnter);
    headersEl.addEventListener('dragover',  onHeadersOver);
    headersEl.addEventListener('dragleave', onHeadersLeave);
    headersEl.addEventListener('drop',      onHeadersDrop);

    return () => {
      headersEl.removeEventListener('dragenter', onHeadersEnter);
      headersEl.removeEventListener('dragover',  onHeadersOver);
      headersEl.removeEventListener('dragleave', onHeadersLeave);
      headersEl.removeEventListener('drop',      onHeadersDrop);
    };
  }, [
    headersScrollRef,
    getDraggedAsset,
    resetDragUI,
    importExternalFiles,
    addClipToTrack,
    createTrackWithClip,
  ]);

  // ═══════════════════════════════════════════════════════════
  // 3.5️⃣ DROP DE ARCHIVOS EXTERNOS EN LANES
  //
  // Los handlers React por lane (handleLaneDragOver/Drop) solo
  // manejan drag interno. Para archivos del OS registramos un
  // listener nativo adicional en lanesScrollRef que resuelve
  // la lane target vía closest('[data-track-id]').
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const lanesScroll = lanesScrollRef.current;
    if (!lanesScroll) return;

    const onLanesDrop = (e: DragEvent) => {
      if (!isExternalFileDrag(e)) return; // dejar pasar drag interno

      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) {
        resetDragUI();
        return;
      }

      // Determinar lane target
      const laneEl = (e.target instanceof Element)
        ? e.target.closest<HTMLElement>('.ws-lane[data-track-id]')
        : null;
      const targetTrackId = laneEl?.dataset.trackId ?? null;

      // Calcular startTime desde posición X del drop
      const rect      = lanesScroll.getBoundingClientRect();
      const scroll    = lanesScroll.scrollLeft;
      const relX      = e.clientX - rect.left + scroll;
      const startTime = snapToBeatRef.current(
        pxToSecondsRef.current(relX, bpmRef.current),
        bpmRef.current,
        e.shiftKey
      );

      const filesSnapshot = Array.from(files);
      resetDragUI();

      void (async () => {
        const assets = await importExternalFiles(filesSnapshot);
        if (assets.length === 0) return;

        if (targetTrackId) {
          // Apilar en la lane target
          let cursor = startTime;
          for (const asset of assets) {
            addClipToTrack(targetTrackId, asset, cursor);
            cursor += asset.duration;
          }
        } else {
          // No hay lane target → crear tracks nuevos
          for (const asset of assets) {
            createTrackWithClip(asset, startTime);
          }
        }
      })();
    };

    lanesScroll.addEventListener('drop', onLanesDrop);
    return () => {
      lanesScroll.removeEventListener('drop', onLanesDrop);
    };
  }, [
    lanesScrollRef,
    resetDragUI,
    importExternalFiles,
    addClipToTrack,
    createTrackWithClip,
  ]);

  // ═══════════════════════════════════════════════════════════
  // 4️⃣ HANDLERS REACT PARA LANES (solo drag interno)
  // ═══════════════════════════════════════════════════════════

  const handleLaneDragOver = useCallback(
    (e: React.DragEvent, trackId: string) => {
      // Si es drag externo, dejar que el listener nativo lo maneje.
      // Aquí solo actualizamos el asset preview del drag interno.
      const info = getDraggedAsset();
      if (!info) return;

      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'copy';

      const track     = tracksByIdRef.current[trackId];
      const rect      = e.currentTarget.getBoundingClientRect();
      const startTime = snapToBeatRef.current(
        pxToSecondsRef.current(e.clientX - rect.left, bpmRef.current),
        bpmRef.current,
        e.shiftKey
      );

      setAssetPreview({
        trackId,
        startTime,
        duration: info.asset.duration,
        name:     info.asset.name,
        color:    track?.color ?? 'var(--accent)',
        assetId:  info.id,
      });
    },
    [getDraggedAsset]
  );

  const handleLaneDrop = useCallback(
    (e: React.DragEvent, trackId: string) => {
      // Drag externo → lo procesa el listener nativo de lanesScroll
      if (isExternalFileDrag(e.nativeEvent)) return;

      const info = getDraggedAsset();

      if (!info) {
        warnDev(
          'handleLaneDrop: no hay asset registrado en dragState. ' +
          '¿Se llamó setDraggedAssetId() en Sidebar.handleAssetDragStart?'
        );
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const { asset } = info;

      clearDraggedAssetId();
      resetDragUI();

      const rect      = e.currentTarget.getBoundingClientRect();
      const startTime = snapToBeatRef.current(
        pxToSecondsRef.current(e.clientX - rect.left, bpmRef.current),
        bpmRef.current,
        e.shiftKey
      );

      addClipToTrack(trackId, asset, startTime);
    },
    [getDraggedAsset, resetDragUI, addClipToTrack]
  );

  // ─── Limpieza en desmontaje ─────────────────────────────────
  useEffect(() => {
    return () => {
      resetDragUI();
      clearDraggedAssetId();
    };
  }, [resetDragUI]);

  return {
    assetPreview,
    isDraggingAsset,
    isImportingFiles,
    headerDropTarget,
    handleLaneDragOver,
    handleLaneDrop,
    setAssetPreview,
  };
}