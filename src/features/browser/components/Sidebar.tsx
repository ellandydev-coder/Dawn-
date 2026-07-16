import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import { addAsset, removeAsset } from '@state/slices/assets/assetsSlice';
import { selectShowBrowser } from '@state/slices/ui/uiSlice';
import { FileImportService } from '@services/file-io/FileImportService';
import { AssetRegistry } from '@services/assets/AssetRegistry';
import { SamplePlayer } from '@audio/instruments/SamplePlayer';
import { FileDropZone, type RejectedFile } from './FileDropZone';
import { AssetItem } from './AssetItem';
import { Icon } from '@shared/components/Icon';
import {
  setDraggedAssetId,
  clearDraggedAssetId,
} from '@shared/utils/dragState';
import type { Asset } from '@domain/models/Asset';

import './Sidebar.css';

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════

const ERROR_DISPLAY_MS = 4000;
const SUPPORTED_FORMATS = FileImportService.getSupportedFormats()
  .map((ext) => ext.toUpperCase())
  .join(' · ');

/**
 * Nombre de la CSS variable que controla el ancho del sidebar
 * en el layout principal (definida en variables.css).
 */
const SIDEBAR_WIDTH_VAR = '--sidebar-width';

/** Ancho por defecto del sidebar cuando está visible */
const SIDEBAR_WIDTH_VISIBLE = '200px';

/** Ancho del sidebar cuando está oculto (colapsa la columna del grid) */
const SIDEBAR_WIDTH_HIDDEN = '0px';

// ═══════════════════════════════════════════
// Helpers puros
// ═══════════════════════════════════════════

function isExternalFileDrag(e: DragEvent): boolean {
  return Array.from(e.dataTransfer.types).includes('Files');
}

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

// ═══════════════════════════════════════════
// Componente
// ═══════════════════════════════════════════

export function Sidebar() {
  const dispatch = useAppDispatch();

  // ── Selectores atómicos
  const assetsById      = useAppSelector((s) => s.assets.byId);
  const assetAllIds     = useAppSelector((s) => s.assets.allIds);
  const selectedTrackId = useAppSelector((s) => s.tracks.selectedTrackId);

  // ── Visibilidad controlada por el usuario (uiSlice)
  //
  //  ⚠️  IMPORTANTE: el sidebar ya NO se muestra automáticamente
  //  cuando hay assets. Su visibilidad es exclusivamente una
  //  decisión del usuario (toggle en topbar o atajo Ctrl+B).
  //
  //  Esto evita que arrastrar un archivo al timeline provoque
  //  la aparición del sidebar (comportamiento antiguo).
  const isVisible = useAppSelector(selectShowBrowser);

  // ── UI state
  const [draggingId,   setDraggingId]   = useState<string | null>(null);
  const [isFileHover,  setIsFileHover]  = useState(false);
  const [importError,  setImportError]  = useState<string | null>(null);
  const [isImporting,  setIsImporting]  = useState(false);

  // ── Refs
  const dragCounterRef   = useRef(0);
  const errorTimeoutRef  = useRef<number | null>(null);
  const isMountedRef     = useRef(true);

  // ═══════════════════════════════════
  // Cleanup general
  // ═══════════════════════════════════

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (errorTimeoutRef.current !== null) {
        window.clearTimeout(errorTimeoutRef.current);
      }
    };
  }, []);

  // ═══════════════════════════════════
  // Reset hover si drag termina fuera del sidebar
  // ═══════════════════════════════════

  useEffect(() => {
    const reset = () => {
      dragCounterRef.current = 0;
      setIsFileHover(false);
    };

    window.addEventListener('dragend', reset);
    window.addEventListener('drop',    reset);

    return () => {
      window.removeEventListener('dragend', reset);
      window.removeEventListener('drop',    reset);
    };
  }, []);

  // ═══════════════════════════════════
  // Sincronizar el ancho del sidebar con el layout principal.
  //
  // Ahora el ancho depende exclusivamente de `isVisible` (uiSlice).
  // Si el usuario cierra el sidebar, la columna colapsa y el
  // timeline ocupa el 100%.
  //
  // Al desmontarse el componente, restauramos el ancho por
  // defecto para no dejar el grid roto.
  // ═══════════════════════════════════

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty(
      SIDEBAR_WIDTH_VAR,
      isVisible ? SIDEBAR_WIDTH_VISIBLE : SIDEBAR_WIDTH_HIDDEN
    );

    return () => {
      root.style.setProperty(SIDEBAR_WIDTH_VAR, SIDEBAR_WIDTH_VISIBLE);
    };
  }, [isVisible]);

  // ═══════════════════════════════════
  // Error temporal
  // ═══════════════════════════════════

  const showError = useCallback((msg: string) => {
    setImportError(msg);

    if (errorTimeoutRef.current !== null) {
      window.clearTimeout(errorTimeoutRef.current);
    }

    errorTimeoutRef.current = window.setTimeout(() => {
      if (isMountedRef.current) setImportError(null);
      errorTimeoutRef.current = null;
    }, ERROR_DISPLAY_MS);
  }, []);

  // ═══════════════════════════════════
  // Handlers de archivos
  // ═══════════════════════════════════

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      setIsImporting(true);

      try {
        const imported = await FileImportService.importFiles(files);

        if (imported.length === 0) {
          showError('No se pudo importar ningún archivo');
          return;
        }

        for (const asset of imported) {
          dispatch(addAsset(asset));
        }
      } catch (err) {
        console.error('[Sidebar] Error importando archivos:', err);
        showError('Error al importar uno o más archivos');
      } finally {
        if (isMountedRef.current) setIsImporting(false);
      }
    },
    [dispatch, showError]
  );

  const handleRejected = useCallback(
    (rejected: RejectedFile[]) => {
      const count = rejected.length;
      showError(
        `${count} ${pluralize(count, 'archivo rechazado', 'archivos rechazados')}`
      );
    },
    [showError]
  );

  const handlePlay = useCallback(
    (assetId: string) => {
      if (!selectedTrackId) return;
      const buf = AssetRegistry.get(assetId);
      if (buf) SamplePlayer.play(buf, selectedTrackId);
    },
    [selectedTrackId]
  );

  const handleRemove = useCallback(
    (id: string) => {
      AssetRegistry.remove(id);
      dispatch(removeAsset(id));
    },
    [dispatch]
  );

  // ═══════════════════════════════════
  // Drag de assets hacia la timeline
  // ═══════════════════════════════════

  const handleAssetDragStart = useCallback((id: string) => {
    setDraggingId(id);
    setDraggedAssetId(id);
  }, []);

  const handleAssetDragEnd = useCallback(() => {
    setDraggingId(null);
    clearDraggedAssetId();
  }, []);

  // ═══════════════════════════════════
  // Drag de archivos externos hacia el sidebar
  // ═══════════════════════════════════

  const handleSidebarDragEnter = useCallback((e: DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    dragCounterRef.current += 1;
    setIsFileHover(true);
  }, []);

  const handleSidebarDragLeave = useCallback((e: DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    dragCounterRef.current = Math.max(0, dragCounterRef.current - 1);
    if (dragCounterRef.current === 0) setIsFileHover(false);
  }, []);

  const handleSidebarDragOver = useCallback((e: DragEvent) => {
    if (!isExternalFileDrag(e)) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleSidebarDrop = useCallback(
    (e: DragEvent) => {
      if (!isExternalFileDrag(e)) return;
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsFileHover(false);

      if (e.dataTransfer.files.length > 0) {
        void handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  // ═══════════════════════════════════
  // Derivados memoizados
  // ═══════════════════════════════════

  const assets = useMemo<Asset[]>(
    () =>
      assetAllIds.reduce<Asset[]>((acc, id) => {
        const asset = assetsById[id];
        if (asset) acc.push(asset);
        return acc;
      }, []),
    [assetAllIds, assetsById]
  );

  const canPreview = selectedTrackId !== null;
  const assetCount = assetAllIds.length;

  // ═══════════════════════════════════
  // Early return: sidebar oculto por decisión del usuario.
  //
  // La columna del CSS Grid ya se colapsó vía --sidebar-width: 0px
  // (ver useEffect arriba), así que no queda hueco visible.
  //
  // Para abrirlo: toggle en la topbar o atajo Ctrl+B.
  // ═══════════════════════════════════

  if (!isVisible) return null;

  // ═══════════════════════════════════
  // Render
  // ═══════════════════════════════════

  return (
    <aside
      className={`sidebar${isFileHover ? ' file-hover' : ''}`}
      onDragEnter={handleSidebarDragEnter}
      onDragLeave={handleSidebarDragLeave}
      onDragOver={handleSidebarDragOver}
      onDrop={handleSidebarDrop}
      aria-label="Biblioteca de audio"
    >
      {/* ── Drop overlay ── */}
      {isFileHover && (
        <div
          className="sidebar-drop-overlay"
          role="presentation"
          aria-hidden="true"
        >
          <Icon name="upload" size={48} color="var(--accent)" />
          <div className="drop-overlay-title">Suelta para importar</div>
          <div className="drop-overlay-hint">{SUPPORTED_FORMATS}</div>
        </div>
      )}

      {/* ── Header ── */}
      <header className="panel-header">
        <Icon name="folder" size={14} color="var(--accent)" aria-hidden="true" />
        <span className="panel-title">BIBLIOTECA</span>
        <span
          className="panel-count mono"
          aria-label={`${assetCount} archivos`}
        >
          {assetCount}
        </span>
        {isImporting && (
          <span
            className="panel-loading mono"
            role="status"
            aria-live="polite"
          >
            Importando…
          </span>
        )}
      </header>

      {/* ── Error banner ── */}
      {importError && (
        <div className="sidebar-error" role="alert" aria-live="assertive">
          {importError}
        </div>
      )}

      {/* ── Contenido ── */}
      <div className="sidebar-content">
        <ul
          className="asset-list"
          role="list"
          aria-label="Archivos de audio"
        >
          {assets.map((asset) => (
            <AssetItem
              key={asset.id}
              asset={asset}
              isDragging={draggingId === asset.id}
              canPreview={canPreview}
              confirmDelete={true}
              onDragStart={handleAssetDragStart}
              onDragEnd={handleAssetDragEnd}
              onPlay={handlePlay}
              onRemove={handleRemove}
            />
          ))}
        </ul>

        <div className="sidebar-footer">
          <FileDropZone
            onFilesDropped={handleFiles}
            onRejected={handleRejected}
            disabled={isFileHover}
          />
        </div>
      </div>
    </aside>
  );
}