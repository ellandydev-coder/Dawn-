import { memo, useCallback, useState, type DragEvent, type MouseEvent } from 'react';
import { Icon } from '@shared/components/Icon';
import { DRAG_TYPES } from '@shared/constants/dragTypes';
import type { Asset } from '@domain/models/Asset';

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

/** Formatea la metadata técnica de un asset (duración, SR, canales) */
function formatAssetMeta(asset: Asset): string {
  const dur = asset.duration.toFixed(2);
  const sr = (asset.sampleRate / 1000).toFixed(1);
  const ch =
    asset.numberOfChannels === 1 ? 'mono' : `${asset.numberOfChannels}ch`;
  return `${dur}s · ${sr}kHz · ${ch}`;
}

/**
 * Canvas invisible (1×1 px transparente) usado como drag image.
 *
 * ¿Por qué esto?
 * -------------------------------------------------------------
 * El navegador SIEMPRE muestra una "drag image" al arrastrar un
 * elemento (por defecto: una copia semitransparente del propio nodo).
 *
 * En una DAW el preview real lo dibuja la timeline (clip fantasma
 * con waveform + guías verticales estilo Reaper), así que el ghost
 * del navegador es ruido visual — hay que ocultarlo.
 *
 * La técnica estándar es pasar un canvas 1×1 transparente a
 * setDragImage(). El navegador lo respeta y no muestra nada.
 *
 * Se crea una sola vez y se reutiliza (evita crear/borrar DOM en
 * cada drag).
 */
const INVISIBLE_DRAG_IMAGE: HTMLCanvasElement | null = (() => {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;
  return canvas;
})();

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface AssetItemProps {
  asset: Asset;
  isDragging: boolean;
  canPreview: boolean;

  /** Indica si el asset está reproduciéndose ahora mismo */
  isPlaying?: boolean;

  /** Indica si el asset ya está en el timeline (visual hint) */
  isInUse?: boolean;

  /** Color del track donde se está usando (para acento visual) */
  usageColor?: string;

  onDragStart: (id: string, e: DragEvent<HTMLDivElement>) => void;
  onDragEnd: () => void;
  onPlay: (id: string) => void;
  onStop?: (id: string) => void;
  onRemove: (id: string) => void;

  /** Acción rápida al hacer doble click (default: play) */
  onDoubleClick?: (id: string) => void;

  /** Menú contextual (click derecho) */
  onContextMenu?: (id: string, e: MouseEvent<HTMLDivElement>) => void;

  /** Confirmar antes de eliminar (default: false) */
  confirmDelete?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMPONENTE
// ═══════════════════════════════════════════════════════════════

function AssetItemComponent({
  asset,
  isDragging,
  canPreview,
  isPlaying = false,
  isInUse = false,
  usageColor,
  onDragStart,
  onDragEnd,
  onPlay,
  onStop,
  onRemove,
  onDoubleClick,
  onContextMenu,
  confirmDelete = false,
}: AssetItemProps) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // ─────────────────────────────────────────────
  // Drag
  // ─────────────────────────────────────────────
  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData(DRAG_TYPES.ASSET, asset.id);
      e.dataTransfer.setData('text/plain', asset.id);
      e.dataTransfer.effectAllowed = 'copy';

      // Suprimir el drag image nativo del navegador.
      // El preview real lo pinta la timeline (Workspace / TrackLane).
      if (INVISIBLE_DRAG_IMAGE) {
        e.dataTransfer.setDragImage(INVISIBLE_DRAG_IMAGE, 0, 0);
      }

      onDragStart(asset.id, e);
    },
    [asset.id, onDragStart]
  );

  // ─────────────────────────────────────────────
  // Play / Stop toggle
  // ─────────────────────────────────────────────
  const handlePlayToggle = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();
      if (isPlaying && onStop) {
        onStop(asset.id);
      } else {
        onPlay(asset.id);
      }
    },
    [asset.id, isPlaying, onPlay, onStop]
  );

  // ─────────────────────────────────────────────
  // Delete con confirmación opcional
  // ─────────────────────────────────────────────
  const handleRemoveClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>) => {
      e.stopPropagation();

      if (!confirmDelete) {
        onRemove(asset.id);
        return;
      }

      if (confirmingDelete) {
        onRemove(asset.id);
        setConfirmingDelete(false);
      } else {
        setConfirmingDelete(true);
        window.setTimeout(() => setConfirmingDelete(false), 3000);
      }
    },
    [asset.id, confirmDelete, confirmingDelete, onRemove]
  );

  // ─────────────────────────────────────────────
  // Doble click
  // ─────────────────────────────────────────────
  const handleDoubleClick = useCallback(() => {
    if (onDoubleClick) {
      onDoubleClick(asset.id);
    } else if (canPreview) {
      onPlay(asset.id);
    }
  }, [asset.id, canPreview, onDoubleClick, onPlay]);

  // ─────────────────────────────────────────────
  // Menú contextual
  // ─────────────────────────────────────────────
  const handleContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (onContextMenu) {
        e.preventDefault();
        onContextMenu(asset.id, e);
      }
    },
    [asset.id, onContextMenu]
  );

  // ─────────────────────────────────────────────
  // Clases dinámicas
  // ─────────────────────────────────────────────
  const classes = [
    'asset-item',
    isDragging && 'is-dragging',
    isPlaying && 'is-playing',
    isInUse && 'is-in-use',
    confirmingDelete && 'is-confirming-delete',
  ]
    .filter(Boolean)
    .join(' ');

  const thumbStyle = usageColor
    ? { background: `${usageColor}22`, boxShadow: `0 0 0 1px ${usageColor}` }
    : undefined;

  // ═══════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════
  return (
    <div
      className={classes}
      data-testid={`asset-item-${asset.id}`}
      role="listitem"
      draggable
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
      title={`${asset.name}\n\n💡 Arrastra al timeline · Doble click para preview · Click derecho para más`}
    >
      <div className="asset-thumb" style={thumbStyle}>
        <Icon
          name={isPlaying ? 'volume' : 'music'}
          size={16}
          color={usageColor ?? 'var(--accent)'}
        />
      </div>

      <div className="asset-info">
        <div className="asset-name">{asset.name}</div>
        <div className="asset-meta mono">{formatAssetMeta(asset)}</div>
      </div>

      <button
        className={`asset-btn play ${isPlaying ? 'is-active' : ''}`}
        onClick={handlePlayToggle}
        disabled={!canPreview}
        title={
          !canPreview
            ? 'Selecciona una pista primero'
            : isPlaying
              ? 'Detener preview'
              : 'Preview en pista seleccionada'
        }
        aria-label={
          isPlaying ? `Detener ${asset.name}` : `Preview ${asset.name}`
        }
      >
        <Icon name={isPlaying ? 'stop' : 'play'} size={12} />
      </button>

      <button
        className={`asset-btn del ${confirmingDelete ? 'is-confirming' : ''}`}
        onClick={handleRemoveClick}
        title={
          confirmingDelete ? 'Click de nuevo para confirmar' : 'Eliminar'
        }
        aria-label={
          confirmingDelete
            ? `Confirmar eliminación de ${asset.name}`
            : `Eliminar ${asset.name}`
        }
      >
        <Icon name={confirmingDelete ? 'x' : 'trash'} size={12} />
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// 🎯 EXPORT MEMOIZADO
// ═══════════════════════════════════════════════════════════════

/** Comparación custom para evitar re-renders innecesarios */
export const AssetItem = memo(AssetItemComponent, (prev, next) => {
  return (
    prev.asset === next.asset &&
    prev.isDragging === next.isDragging &&
    prev.canPreview === next.canPreview &&
    prev.isPlaying === next.isPlaying &&
    prev.isInUse === next.isInUse &&
    prev.usageColor === next.usageColor &&
    prev.confirmDelete === next.confirmDelete &&
    prev.onDragStart === next.onDragStart &&
    prev.onDragEnd === next.onDragEnd &&
    prev.onPlay === next.onPlay &&
    prev.onStop === next.onStop &&
    prev.onRemove === next.onRemove &&
    prev.onDoubleClick === next.onDoubleClick &&
    prev.onContextMenu === next.onContextMenu
  );
});