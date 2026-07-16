// src/features/mixer/components/MixerView.tsx

import { memo, useCallback, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '@state/store';
import { addTrack } from '@state/slices/tracks/tracksSlice';
import { ChannelStrip } from './ChannelStrip';
import { MasterChannel } from './MasterChannel';
import './MixerView.css';

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════

const TRACK_COLORS = [
  '#ff6b6b',
  '#4ecdc4',
  '#ffe66d',
  '#a78bfa',
  '#60a5fa',
  '#f472b6',
  '#fb923c',
  '#34d399',
] as const;

const DEFAULT_TRACK_NAME_PREFIX = 'Canal';

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

function getTrackColor(index: number): string {
  return TRACK_COLORS[index % TRACK_COLORS.length];
}

function buildCountText(count: number): string {
  if (count === 0) return 'Sin canales';
  if (count === 1) return '1 canal';
  return `${count} canales`;
}

// ═══════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════

export interface MixerViewProps {
  /** Prefijo del nombre para nuevas pistas */
  trackNamePrefix?: string;
  /** Callback tras añadir una pista */
  onTrackAdded?: (trackId: string) => void;
  /** Mostrar/ocultar el header */
  showHeader?: boolean;
}

/**
 * MixerView
 * ---------
 * Vista principal del mixer estilo REAPER.
 *
 * Layout:
 *   [Header]
 *   [MASTER] [Canal 1] [Canal 2] ... [+ Añadir]
 *
 * ✔ Memoizado
 * ✔ Handlers estables
 * ✔ Scroll horizontal con rueda del ratón
 * ✔ Keyboard shortcut (Ctrl/Cmd + T = nueva pista)
 * ✔ Accesible (ARIA + roles)
 * ✔ Configurable
 */
function MixerViewBase({
  trackNamePrefix = DEFAULT_TRACK_NAME_PREFIX,
  onTrackAdded,
  showHeader = true,
}: MixerViewProps) {
  const dispatch = useAppDispatch();

  // ─── Selectores atómicos ────────────────
  const trackIds = useAppSelector((s) => s.tracks.allIds);

  const trackCount = trackIds.length;
  const isEmpty = trackCount === 0;

  // ─── Handlers estables ──────────────────

  const handleAddChannel = useCallback(() => {
    const idx = trackIds.length;

    const action = dispatch(
      addTrack({
        name: `${trackNamePrefix} ${idx + 1}`,
        type: 'audio',
        color: getTrackColor(idx),
      })
    );

    if (onTrackAdded) {
      const payload = action?.payload as { id?: string } | undefined;
      if (payload?.id) {
        onTrackAdded(payload.id);
      }
    }
  }, [dispatch, trackIds.length, trackNamePrefix, onTrackAdded]);

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (e.deltaY === 0) return;

      const target = e.currentTarget;
      if (target.scrollWidth <= target.clientWidth) return;

      e.preventDefault();
      target.scrollLeft += e.deltaY;
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && e.key.toLowerCase() === 't') {
        e.preventDefault();
        handleAddChannel();
      }
    },
    [handleAddChannel]
  );

  // ─── Derivados memoizados ───────────────

  const countText = useMemo(
    () => buildCountText(trackCount),
    [trackCount]
  );

  // ═══════════════════════════════════════
  // Render
  // ═══════════════════════════════════════

  return (
    <div
      className="mixer-view"
      role="region"
      aria-label="Mezclador"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Header */}
      {showHeader && (
        <div className="mixer-header">
          <span className="mixer-title">MIXER</span>
          <span
            className="mixer-count mono"
            aria-live="polite"
            aria-atomic="true"
          >
            {countText}
          </span>
        </div>
      )}

      {/* Contenido */}
      <div className="mixer-scroll" onWheel={handleWheel}>

        {/* Master — siempre visible */}
        <div className="mixer-master-wrap">
          <MasterChannel />
        </div>

        {/* Canales o empty state */}
        <div
          className="mixer-strips"
          role="list"
          aria-label="Canales del mezclador"
        >
          {isEmpty ? (
            <div className="mixer-empty" role="status" aria-live="polite">
              <p className="mixer-empty-text">No hay canales todavía</p>
              <button
                type="button"
                className="mixer-add-first"
                onClick={handleAddChannel}
                title="Añadir el primer canal (Ctrl+T)"
                aria-label="Añadir el primer canal"
              >
                + Añadir canal
              </button>
            </div>
          ) : (
            <>
              {trackIds.map((id, idx) => (
                <div key={id} role="listitem">
                  <ChannelStrip trackId={id} channelNumber={idx + 1} />
                </div>
              ))}

              <button
                type="button"
                className="mixer-add-btn"
                onClick={handleAddChannel}
                title="Añadir canal (Ctrl+T)"
                aria-label="Añadir nuevo canal"
              >
                +
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export const MixerView = memo(MixerViewBase);