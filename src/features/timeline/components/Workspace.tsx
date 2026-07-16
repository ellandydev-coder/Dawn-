// src/features/timeline/components/Workspace.tsx

import {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
  type MouseEvent as ReactMouseEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  moveClip,
  removeClip,
  selectClips,
} from '@state/slices/clips/clipsSlice';
import {
  addTrack,
  addClipIdToTrack,
  removeClipIdFromTrack,
  renameTrack,
  selectTrack,
} from '@state/slices/tracks/tracksSlice';
import { setEditCursor } from '@state/slices/transport/transportSlice';
import {
  openClipProperties,
  closeClipProperties,
  selectClipPropertiesModalId,
} from '@state/slices/ui/uiSlice';
import { Icon } from '@shared/components/Icon';
import { TrackHeader } from './TrackHeader';
import { TrackLane } from './TrackLane';
import { useAssetDragDrop } from '../hooks/useAssetDragDrop';
import type { LiveDragState } from './TrackLane';

import './Workspace.css';
import './Cursors.css';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const PX_PER_BEAT = 30;
const BEATS_PER_BAR = 4;
const PX_PER_BAR = PX_PER_BEAT * BEATS_PER_BAR;
const MIN_BARS = 20;
const BARS_LOOKAHEAD = 4;
const DEFAULT_LANE_HEIGHT = 80;
const HEADER_WIDTH = 200;
const PLAYHEAD_SCROLL_MARGIN_RATIO = 0.2;

const TRACK_COLORS = [
  'var(--track-1)', 'var(--track-2)', 'var(--track-3)', 'var(--track-4)',
  'var(--track-5)', 'var(--track-6)', 'var(--track-7)', 'var(--track-8)',
] as const;

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS DE TIEMPO (puros — a nivel de módulo)
// ═══════════════════════════════════════════════════════════════

function secondsToPx(seconds: number, bpm: number): number {
  return seconds * (bpm / 60) * PX_PER_BEAT;
}

function pxToSeconds(px: number, bpm: number): number {
  return px / PX_PER_BEAT / (bpm / 60);
}

function snapToBeat(seconds: number, bpm: number, disableSnap = false): number {
  if (disableSnap) return Math.max(0, seconds);
  const bps = bpm / 60;
  return Math.max(0, Math.round(seconds * bps) / bps);
}

function getTrackColor(index: number): string {
  return TRACK_COLORS[index % TRACK_COLORS.length];
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ WORKSPACE
// ═══════════════════════════════════════════════════════════════

export function Workspace() {
  const dispatch = useAppDispatch();

  // ─── Selectores atómicos ────────────────────────────────────
  const trackIds   = useAppSelector((s) => s.tracks.allIds);
  const tracksById = useAppSelector((s) => s.tracks.byId);
  const clipsById  = useAppSelector((s) => s.clips.byId);
  const clipAllIds = useAppSelector((s) => s.clips.allIds);
  const playhead   = useAppSelector((s) => s.transport.playheadSeconds);
  const editCursor = useAppSelector((s) => s.transport.editCursorSeconds);
  const isPlaying  = useAppSelector((s) => s.transport.isPlaying);
  const bpm        = useAppSelector((s) => s.project.current.bpm);

  // ─── Modal de propiedades del clip (estado global) ──────────
  const propertiesClipId = useAppSelector(selectClipPropertiesModalId);

  // ─── Estado local (solo drag de CLIPS internos) ─────────────
  const [liveDrag, setLiveDrag] = useState<LiveDragState | null>(null);

  // ─── Refs ───────────────────────────────────────────────────
  const rulerScrollRef   = useRef<HTMLDivElement>(null);
  const lanesScrollRef   = useRef<HTMLDivElement>(null);
  const lanesRef         = useRef<HTMLDivElement>(null);
  const headersScrollRef = useRef<HTMLDivElement>(null);

  // ─── D&D de assets externos (listeners nativos — bypass React) ──
  const {
    assetPreview,
    isDraggingAsset,
    headerDropTarget,
    handleLaneDragOver,
    handleLaneDrop,
  } = useAssetDragDrop({
    bpm,
    trackIds,
    editCursorSeconds: editCursor,
    lanesScrollRef,
    headersScrollRef,
    pxToSeconds,
    snapToBeat,
    getTrackColor,
  });

  // ─── Selección memoizada ────────────────────────────────────
  const selectedClipIds = useAppSelector((s) => s.clips.selectedClipIds);
  const selectedClipIdsSet = useMemo(
    () => new Set(selectedClipIds),
    [selectedClipIds]
  );

  // ─── Alturas por track (leídas del state) ───────────────────
  /**
   * Devuelve la altura real de una track según el state.
   * Si por algún motivo no está definida, cae al default.
   */
  const getTrackHeight = useCallback(
    (tid: string): number => {
      return tracksById[tid]?.height ?? DEFAULT_LANE_HEIGHT;
    },
    [tracksById]
  );

  /**
   * Para calcular en qué lane está el ratón durante drag,
   * necesitamos las offsets verticales acumuladas de cada track.
   */
  const laneOffsets = useMemo(() => {
    const offsets: number[] = [];
    let acc = 0;
    for (const tid of trackIds) {
      offsets.push(acc);
      acc += getTrackHeight(tid);
    }
    return offsets;
  }, [trackIds, getTrackHeight]);

  // ─── Dimensiones del timeline ───────────────────────────────
  const totalBars = useMemo(() => {
    let maxSec = 0;
    for (const cid of clipAllIds) {
      const c = clipsById[cid];
      if (!c) continue;
      const end = c.startTime + c.duration;
      if (end > maxSec) maxSec = end;
    }
    const cursorMax = Math.max(playhead, editCursor);
    if (cursorMax > maxSec) maxSec = cursorMax;

    const bars =
      Math.ceil(secondsToPx(maxSec, bpm) / PX_PER_BAR) + BARS_LOOKAHEAD;
    return Math.max(MIN_BARS, bars);
  }, [clipAllIds, clipsById, playhead, editCursor, bpm]);

  const timelineWidth = totalBars * PX_PER_BAR;
  const playheadPx    = secondsToPx(playhead, bpm);
  const editCursorPx  = secondsToPx(editCursor, bpm);

  // ═══════════════════════════════════════════════════════════
  // SINCRONIZACIÓN DE SCROLL
  // ═══════════════════════════════════════════════════════════

  // Horizontal: ruler ↔ lanes
  useEffect(() => {
    const rulerEl = rulerScrollRef.current;
    const lanesEl = lanesScrollRef.current;
    if (!rulerEl || !lanesEl) return;

    let syncing = false;
    const syncFromLanes = () => {
      if (syncing) return;
      syncing = true;
      rulerEl.scrollLeft = lanesEl.scrollLeft;
      syncing = false;
    };
    const syncFromRuler = () => {
      if (syncing) return;
      syncing = true;
      lanesEl.scrollLeft = rulerEl.scrollLeft;
      syncing = false;
    };

    lanesEl.addEventListener('scroll', syncFromLanes, { passive: true });
    rulerEl.addEventListener('scroll', syncFromRuler, { passive: true });
    return () => {
      lanesEl.removeEventListener('scroll', syncFromLanes);
      rulerEl.removeEventListener('scroll', syncFromRuler);
    };
  }, []);

  // Vertical: headers ↔ lanes
  useEffect(() => {
    const headersEl = headersScrollRef.current;
    const lanesEl   = lanesScrollRef.current;
    if (!headersEl || !lanesEl) return;

    let syncing = false;
    const syncFromLanes = () => {
      if (syncing) return;
      syncing = true;
      headersEl.scrollTop = lanesEl.scrollTop;
      syncing = false;
    };
    const syncFromHeaders = () => {
      if (syncing) return;
      syncing = true;
      lanesEl.scrollTop = headersEl.scrollTop;
      syncing = false;
    };

    lanesEl.addEventListener('scroll', syncFromLanes, { passive: true });
    headersEl.addEventListener('scroll', syncFromHeaders, { passive: true });
    return () => {
      lanesEl.removeEventListener('scroll', syncFromLanes);
      headersEl.removeEventListener('scroll', syncFromHeaders);
    };
  }, []);

  // Auto-scroll del playhead durante reproducción
  useEffect(() => {
    if (!isPlaying || !lanesScrollRef.current) return;
    const el = lanesScrollRef.current;
    const { scrollLeft, clientWidth } = el;
    const margin = clientWidth * PLAYHEAD_SCROLL_MARGIN_RATIO;
    if (playheadPx > scrollLeft + clientWidth - margin) {
      el.scrollLeft = playheadPx - margin;
    }
  }, [isPlaying, playheadPx]);

  // ═══════════════════════════════════════════════════════════
  // DRAG DE CLIPS (mouse nativo — más preciso que HTML5 drag)
  // ═══════════════════════════════════════════════════════════

  const handleClipMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>, clipId: string) => {
      if (e.button !== 0 || e.detail === 2) return;
      const clip = clipsById[clipId];
      if (!clip) return;
      const rect = e.currentTarget.getBoundingClientRect();
      setLiveDrag({
        clipId,
        originalTrackId:  clip.trackId,
        currentTrackId:   clip.trackId,
        currentStartTime: clip.startTime,
        mouseOffsetPx:    e.clientX - rect.left,
      });
      e.preventDefault();
    },
    [clipsById]
  );

  useEffect(() => {
    if (!liveDrag) return;

    const handleMove = (e: MouseEvent) => {
      const lanesEl  = lanesRef.current;
      const scrollEl = lanesScrollRef.current;
      if (!lanesEl || !scrollEl) return;

      const rect    = lanesEl.getBoundingClientRect();
      const scroll  = scrollEl.scrollLeft;
      const relX    = e.clientX - rect.left + scroll;
      const startPx = relX - liveDrag.mouseOffsetPx;
      const newStart = snapToBeat(pxToSeconds(startPx, bpm), bpm, e.shiftKey);

      // Detectar en qué lane está el ratón, usando alturas por track
      const relY = e.clientY - rect.top;
      let laneIdx = 0;
      for (let i = 0; i < trackIds.length; i++) {
        const start = laneOffsets[i];
        const end = start + getTrackHeight(trackIds[i]);
        if (relY >= start && relY < end) {
          laneIdx = i;
          break;
        }
        if (i === trackIds.length - 1 && relY >= end) {
          laneIdx = i;
        }
      }
      const targetTrackId = trackIds[laneIdx] ?? liveDrag.originalTrackId;

      setLiveDrag((prev) =>
        prev
          ? { ...prev, currentStartTime: newStart, currentTrackId: targetTrackId }
          : null
      );
    };

    const handleUp = () => {
      setLiveDrag((prev) => {
        if (!prev) return null;
        dispatch(moveClip({ id: prev.clipId, startTime: prev.currentStartTime }));
        if (prev.currentTrackId !== prev.originalTrackId) {
          dispatch(removeClipIdFromTrack({
            trackId: prev.originalTrackId,
            clipId:  prev.clipId,
          }));
          dispatch(addClipIdToTrack({
            trackId: prev.currentTrackId,
            clipId:  prev.clipId,
          }));
          dispatch(selectTrack(prev.currentTrackId));
        }
        return null;
      });
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [liveDrag, trackIds, laneOffsets, getTrackHeight, dispatch, bpm]);

  // ═══════════════════════════════════════════════════════════
  // HANDLERS DE UI
  // ═══════════════════════════════════════════════════════════

  const handleAddTrack = useCallback(() => {
    const idx = trackIds.length;
    dispatch(addTrack({
      name:  `Track ${idx + 1}`,
      type:  'audio',
      color: getTrackColor(idx),
    }));
  }, [trackIds.length, dispatch]);

  const handleDeleteClip = useCallback(
    (clipId: string) => {
      const clip = clipsById[clipId];
      if (!clip) return;
      dispatch(removeClipIdFromTrack({ trackId: clip.trackId, clipId }));
      dispatch(removeClip(clipId));
    },
    [clipsById, dispatch]
  );

  const handleRenameTrack = useCallback(
    (trackId: string, newName: string) => {
      dispatch(renameTrack({ id: trackId, name: newName }));
    },
    [dispatch]
  );

  const handleHeadersDoubleClick = useCallback(
    (e: ReactMouseEvent) => {
      if ((e.target as HTMLElement).closest('.rpr-track')) return;
      handleAddTrack();
    },
    [handleAddTrack]
  );

  const handleLanesDoubleClick = useCallback(
    (e: ReactMouseEvent) => {
      if ((e.target as HTMLElement).closest('.clip-v2')) return;
      handleAddTrack();
    },
    [handleAddTrack]
  );

  const handleRulerClick = useCallback(
    (e: ReactMouseEvent) => {
      const scrollLeft = rulerScrollRef.current?.scrollLeft ?? 0;
      const rect = e.currentTarget.getBoundingClientRect();
      const x    = e.clientX - rect.left + scrollLeft;
      dispatch(setEditCursor(snapToBeat(pxToSeconds(x, bpm), bpm, e.shiftKey)));
    },
    [dispatch, bpm]
  );

  const handleLanesClick = useCallback(
    (e: ReactMouseEvent) => {
      if ((e.target as HTMLElement).closest('.clip-v2')) return;
      const scrollLeft = lanesScrollRef.current?.scrollLeft ?? 0;
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x    = e.clientX - rect.left + scrollLeft;
      dispatch(setEditCursor(snapToBeat(pxToSeconds(x, bpm), bpm, e.shiftKey)));
    },
    [dispatch, bpm]
  );

  const handleAddTrackKeyDown = useCallback(
    (e: ReactKeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleAddTrack();
      }
    },
    [handleAddTrack]
  );

  // ═══════════════════════════════════════════════════════════
  // 🆕 MODAL DE PROPIEDADES DEL CLIP (estado global en uiSlice)
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    if (propertiesClipId && !clipsById[propertiesClipId]) {
      dispatch(closeClipProperties());
    }
  }, [propertiesClipId, clipsById, dispatch]);

  // ═══════════════════════════════════════════════════════════
  // ⌨️ KEYBOARD SHORTCUTS GLOBALES
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    const isTypingContext = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
      if (target.isContentEditable) return true;
      return false;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !propertiesClipId) {
        dispatch(selectClips([]));
        return;
      }

      if (e.key === 'F2') {
        if (isTypingContext(e.target)) return;
        if (selectedClipIds.length === 0) return;
        e.preventDefault();
        dispatch(openClipProperties(selectedClipIds[0]));
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatch, selectedClipIds, propertiesClipId]);

  // ═══════════════════════════════════════════════════════════
  // CLASES DINÁMICAS PARA DROP DE ASSET SOBRE HEADERS
  // ═══════════════════════════════════════════════════════════

  const headersColClassName = useMemo(
    () =>
      [
        'ws-headers-col',
        headerDropTarget && 'is-drop-active',
        headerDropTarget?.kind === 'new' && 'is-drop-new',
      ]
        .filter(Boolean)
        .join(' '),
    [headerDropTarget]
  );

  const addTrackSlotClassName = useMemo(
    () =>
      [
        'rpr-add-track-slot',
        headerDropTarget?.kind === 'new' && 'is-drop-target',
      ]
        .filter(Boolean)
        .join(' '),
    [headerDropTarget]
  );

  const getHeaderWrapperClassName = useCallback(
    (tid: string) => {
      const isTarget =
        headerDropTarget?.kind === 'track' &&
        headerDropTarget.trackId === tid;
      return isTarget
        ? 'ws-header-wrap is-drop-target'
        : 'ws-header-wrap';
    },
    [headerDropTarget]
  );

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <div className="ws-bl-wrapper">
      <div className="ws-bl">

        {/* ── FILA 1: Spacer + Ruler ────────────────────────── */}
        <div className="ws-top-row">
          <div
            className="ws-add-track-wrap"
            style={{ width: HEADER_WIDTH }}
            aria-hidden="true"
          />
          <div className="ws-ruler-scroll-header" ref={rulerScrollRef}>
            <div
              className="ws-ruler"
              style={{ width: timelineWidth, cursor: 'text' }}
              onClick={handleRulerClick}
              title="Clic para mover el edit cursor · Shift para sin snap"
              role="slider"
              aria-label="Regla de tiempo"
              aria-valuemin={0}
              aria-valuemax={totalBars * BEATS_PER_BAR}
              aria-valuenow={Math.round(editCursor * (bpm / 60))}
              aria-valuetext={`${editCursor.toFixed(2)}s`}
            >
              {Array.from({ length: totalBars }, (_, i) => (
                <div
                  key={i}
                  className="ws-bar"
                  style={{ left: i * PX_PER_BAR, width: PX_PER_BAR }}
                >
                  <span className="ws-bar-num mono">{i + 1}</span>
                  {Array.from({ length: BEATS_PER_BAR - 1 }, (_, j) => (
                    <div
                      key={j}
                      className="ws-beat"
                      style={{ left: (j + 1) * PX_PER_BEAT }}
                    />
                  ))}
                </div>
              ))}
              <div
                className="ws-edit-cursor-marker"
                style={{ left: editCursorPx }}
                aria-hidden="true"
              >
                <div className="ws-edit-cursor-triangle-ruler" />
              </div>
            </div>
          </div>
        </div>

        {/* ── FILA 2: Headers + Lanes ───────────────────────── */}
        <div className="ws-main">

          {/* ── Headers ───────────────────────────────────── */}
          <div
            className={headersColClassName}
            style={{ width: HEADER_WIDTH }}
            ref={headersScrollRef}
            onDoubleClick={handleHeadersDoubleClick}
            title="Doble clic para añadir pista · Arrastra audio aquí para crear pista"
          >
            {trackIds.map((tid, idx) => (
              <div
                key={tid}
                className={getHeaderWrapperClassName(tid)}
                data-track-id={tid}
              >
                <TrackHeader
                  trackId={tid}
                  index={idx}
                  height={getTrackHeight(tid)}
                  onRename={handleRenameTrack}
                />
              </div>
            ))}
            <div
              className={addTrackSlotClassName}
              onClick={handleAddTrack}
              onKeyDown={handleAddTrackKeyDown}
              title="Añadir pista · Suelta audio aquí para crear pista con clip"
              role="button"
              tabIndex={0}
              aria-label="Añadir pista"
            >
              <div className="rpr-add-circle">
                <Icon name="plus" size={14} />
              </div>
            </div>
          </div>

          {/* ── Lanes ─────────────────────────────────────── */}
          <div
            className="ws-lanes-scroll"
            ref={lanesScrollRef}
            onDoubleClick={handleLanesDoubleClick}
            onClick={handleLanesClick}
          >
            <div
              className={[
                'ws-body',
                liveDrag        && 'is-dragging-clip',
                isDraggingAsset && 'is-dragging-asset',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{ width: timelineWidth }}
              ref={lanesRef}
              role="grid"
              aria-label="Timeline del proyecto"
              aria-rowcount={trackIds.length}
            >
              {/* Edit cursor */}
              <div
                className="ws-edit-cursor"
                style={{ left: editCursorPx }}
                aria-hidden="true"
              />

              {/* Playhead (solo visible durante reproducción) */}
              {isPlaying && (
                <div
                  className="ws-playhead"
                  style={{ left: playheadPx }}
                  aria-hidden="true"
                />
              )}

              {/* ── Lanes de pistas ──────────────────────── */}
              {trackIds.map((tid) => (
                <TrackLane
                  key={tid}
                  trackId={tid}
                  height={getTrackHeight(tid)}
                  bpm={bpm}
                  liveDrag={liveDrag}
                  assetPreview={assetPreview}
                  selectedClipIds={selectedClipIdsSet}
                  onLaneDragOver={handleLaneDragOver}
                  onLaneDrop={handleLaneDrop}
                  onClipMouseDown={handleClipMouseDown}
                  onClipDoubleClick={handleDeleteClip}
                  secondsToPx={secondsToPx}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}