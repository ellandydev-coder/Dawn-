// src/features/timeline/components/TrackLane.tsx

import {
  memo,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useAppSelector } from '@state/store';
import { makeSelectClipsByTrackId } from '@state/selectors/clipSelectors';
import type { Clip } from '@domain/models/Clip';
import { ClipView } from './ClipView';
import { RecordingGhostClip } from './RecordingGhostClip';
import './Clip.css';

// ═══════════════════════════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════════════════════════

const FALLBACK_TRACK_COLOR = '#7a8cff';
const MIN_PREVIEW_WIDTH = 20;

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface LiveDragState {
  clipId: string;
  originalTrackId: string;
  currentTrackId: string;
  currentStartTime: number;
  mouseOffsetPx: number;
}

export interface AssetPreviewState {
  trackId: string | null;
  startTime: number;
  duration: number;
  name: string;
  color: string;
  assetId: string;
}

export interface TrackLaneProps {
  trackId: string;
  height: number;
  bpm: number;
  liveDrag: LiveDragState | null;
  assetPreview: AssetPreviewState | null;
  selectedClipIds?: Set<string>;
  onLaneDragOver: (e: React.DragEvent, trackId: string) => void;
  onLaneDrop: (e: React.DragEvent, trackId: string) => void;
  onLaneClick?: (e: React.MouseEvent, trackId: string) => void;
  onClipMouseDown: (
    e: React.MouseEvent<HTMLDivElement>,
    clipId: string
  ) => void;
  onClipDoubleClick: (clipId: string) => void;
  onClipContextMenu?: (e: React.MouseEvent, clipId: string) => void;
  secondsToPx: (seconds: number, bpm: number) => number;
}

// ═══════════════════════════════════════════════════════════════
// No-op helpers (fuera del componente — referencia estable)
// ═══════════════════════════════════════════════════════════════

const noop = () => {};
const noopMouseDown = (_e: ReactMouseEvent<HTMLDivElement>) => {};

// ═══════════════════════════════════════════════════════════════
// Componente
// ═══════════════════════════════════════════════════════════════

function TrackLaneBase({
  trackId,
  height,
  bpm,
  liveDrag,
  assetPreview,
  selectedClipIds,
  onLaneDragOver,
  onLaneDrop,
  onLaneClick,
  onClipMouseDown,
  onClipDoubleClick,
  onClipContextMenu,
  secondsToPx,
}: TrackLaneProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  // ═══════════════════════════════════════════════════════════
  // Selectores atómicos
  // ═══════════════════════════════════════════════════════════

  const trackExists = useAppSelector(
    (s) => s.tracks.byId[trackId] !== undefined
  );
  const trackName  = useAppSelector((s) => s.tracks.byId[trackId]?.name);
  const trackColor = useAppSelector((s) => s.tracks.byId[trackId]?.color);
  const trackMuted = useAppSelector((s) => s.tracks.byId[trackId]?.muted);

  const selectClipsForThisTrack = useMemo(
    () => makeSelectClipsByTrackId(trackId),
    [trackId]
  );
  const clipsData = useAppSelector(selectClipsForThisTrack);

  const ghostClip = useAppSelector((s) => {
    if (
      !liveDrag ||
      liveDrag.currentTrackId !== trackId ||
      liveDrag.originalTrackId === trackId
    ) {
      return null;
    }
    return s.clips.byId[liveDrag.clipId] ?? null;
  });

  // ═══════════════════════════════════════════════════════════
  // Handlers estables
  // ═══════════════════════════════════════════════════════════

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!isDragOver) setIsDragOver(true);
      onLaneDragOver(e, trackId);
    },
    [isDragOver, onLaneDragOver, trackId]
  );

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (!related || !e.currentTarget.contains(related)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      setIsDragOver(false);
      onLaneDrop(e, trackId);
    },
    [onLaneDrop, trackId]
  );

  const handleLaneClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onLaneClick?.(e, trackId);
      }
    },
    [onLaneClick, trackId]
  );

  const handleClipMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>, clipId: string) => {
      onClipMouseDown(e, clipId);
    },
    [onClipMouseDown]
  );

  const handleClipDoubleClick = useCallback(
    (clipId: string) => {
      onClipDoubleClick(clipId);
    },
    [onClipDoubleClick]
  );

  const handleClipContextMenu = useCallback(
    (e: React.MouseEvent, clipId: string) => {
      onClipContextMenu?.(e, clipId);
    },
    [onClipContextMenu]
  );

  // ═══════════════════════════════════════════════════════════
  // Preview del asset arrastrado
  // ═══════════════════════════════════════════════════════════

  const showAssetPreview = assetPreview?.trackId === trackId;

  const previewGeometry = useMemo(() => {
    if (!showAssetPreview || !assetPreview) return null;

    const leftPx  = secondsToPx(assetPreview.startTime, bpm);
    const widthPx = Math.max(
      MIN_PREVIEW_WIDTH,
      secondsToPx(assetPreview.duration, bpm)
    );

    return { leftPx, widthPx, rightPx: leftPx + widthPx };
  }, [showAssetPreview, assetPreview, secondsToPx, bpm]);

  const guideLeftStyle = useMemo<CSSProperties | null>(
    () => (previewGeometry ? { left: previewGeometry.leftPx } : null),
    [previewGeometry]
  );

  const guideRightStyle = useMemo<CSSProperties | null>(
    () => (previewGeometry ? { left: previewGeometry.rightPx } : null),
    [previewGeometry]
  );

  // ═══════════════════════════════════════════════════════════
  // Derivados memoizados
  // ═══════════════════════════════════════════════════════════

  const laneClassName = useMemo(
    () =>
      ['ws-lane', isDragOver && 'is-drag-over', trackMuted && 'is-muted']
        .filter(Boolean)
        .join(' '),
    [isDragOver, trackMuted]
  );

  const laneAriaLabel = useMemo(() => {
    const count    = clipsData.length;
    const clipWord = count === 1 ? 'clip' : 'clips';
    return `Lane de pista ${trackName ?? trackId}, ${count} ${clipWord}`;
  }, [clipsData.length, trackId, trackName]);

  // ═══════════════════════════════════════════════════════════
  // Early return
  // ═══════════════════════════════════════════════════════════

  if (!trackExists) return null;

  // ═══════════════════════════════════════════════════════════
  // Render
  // ═══════════════════════════════════════════════════════════

  return (
    <div
      className={laneClassName}
      style={{ height }}
      onClick={handleLaneClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="row"
      aria-label={laneAriaLabel}
      data-track-id={trackId}
    >
      {/* ════════════════════════════════════
          CLIPS DE LA PISTA
          ════════════════════════════════════ */}
      {clipsData.map((clip: Clip) => {
        const isDragging = liveDrag?.clipId === clip.id;

        if (isDragging && liveDrag!.currentTrackId !== trackId) {
          return null;
        }

        const startTime  = isDragging ? liveDrag!.currentStartTime : clip.startTime;
        const isSelected = selectedClipIds?.has(clip.id) ?? false;

        return (
          <ClipView
            key={clip.id}
            clipId={clip.id}
            name={clip.name}
            color={trackColor ?? FALLBACK_TRACK_COLOR}
            left={secondsToPx(startTime, bpm)}
            width={secondsToPx(clip.duration, bpm)}
            duration={clip.duration}
            assetId={clip.assetId}
            isDragging={isDragging}
            isSelected={isSelected}
            isMuted={trackMuted}
            onMouseDown={(e) => handleClipMouseDown(e, clip.id)}
            onDoubleClick={() => handleClipDoubleClick(clip.id)}
            onContextMenu={
              onClipContextMenu
                ? (e) => handleClipContextMenu(e, clip.id)
                : undefined
            }
          />
        );
      })}

      {/* ════════════════════════════════════
          GHOST CLIP (desde otra lane)
          ════════════════════════════════════ */}
      {ghostClip && liveDrag && (
        <ClipView
          key={`ghost-${liveDrag.clipId}`}
          clipId={liveDrag.clipId}
          name={ghostClip.name}
          color={trackColor ?? FALLBACK_TRACK_COLOR}
          left={secondsToPx(liveDrag.currentStartTime, bpm)}
          width={secondsToPx(ghostClip.duration, bpm)}
          duration={ghostClip.duration}
          assetId={ghostClip.assetId}
          isDragging={true}
          isSelected={false}
          isMuted={trackMuted}
          onMouseDown={noopMouseDown}
          onDoubleClick={noop}
        />
      )}

      {/* ════════════════════════════════════
          PREVIEW DE ASSET ARRASTRADO
          ════════════════════════════════════ */}
      {showAssetPreview && assetPreview && previewGeometry && (
        <>
          {guideLeftStyle && (
            <div
              className="ws-drop-guide ws-drop-guide-left"
              style={guideLeftStyle}
              aria-hidden="true"
            />
          )}
          {guideRightStyle && (
            <div
              className="ws-drop-guide ws-drop-guide-right"
              style={guideRightStyle}
              aria-hidden="true"
            />
          )}
          <ClipView
            key={`preview-${assetPreview.assetId}`}
            clipId={`preview-${assetPreview.assetId}`}
            name={assetPreview.name}
            color={assetPreview.color}
            left={previewGeometry.leftPx}
            width={previewGeometry.widthPx}
            duration={assetPreview.duration}
            assetId={assetPreview.assetId}
            isDragging={true}
            isSelected={false}
            isMuted={false}
            onMouseDown={noopMouseDown}
            onDoubleClick={noop}
          />
        </>
      )}

      {/* ════════════════════════════════════
          GHOST DE GRABACIÓN EN VIVO
          ════════════════════════════════════ */}
      <RecordingGhostClip
        trackId={trackId}
        bpm={bpm}
        secondsToPx={secondsToPx}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Comparador custom para memo
// ═══════════════════════════════════════════════════════════════

const areEqual = (prev: TrackLaneProps, next: TrackLaneProps): boolean => {
  return (
    prev.trackId        === next.trackId        &&
    prev.height         === next.height         &&
    prev.bpm            === next.bpm            &&
    prev.liveDrag       === next.liveDrag       &&
    prev.assetPreview   === next.assetPreview   &&
    prev.selectedClipIds === next.selectedClipIds &&
    prev.secondsToPx    === next.secondsToPx
  );
};

export const TrackLane = memo(TrackLaneBase, areEqual);