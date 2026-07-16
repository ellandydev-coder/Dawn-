import { memo, useCallback, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  addTrack,
  removeTrack,
  setTrackVolume,
  setTrackPan,
  toggleMute,
  toggleSolo,
  toggleArm,
  selectTrack,
  addClipIdToTrack,
} from '@state/slices/tracks/tracksSlice';
import { addClip } from '@state/slices/clips/clipsSlice';
import { AssetRegistry } from '@services/assets/AssetRegistry';
import { SamplePlayer } from '@audio/instruments/SamplePlayer';
import { Icon } from '@shared/components/Icon';
import { DRAG_TYPES } from '@shared/constants/dragTypes';
import type { Track } from '@domain/models/Track';

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════
const TRACK_COLORS = [
  'var(--track-1)',
  'var(--track-2)',
  'var(--track-3)',
  'var(--track-4)',
  'var(--track-5)',
  'var(--track-6)',
  'var(--track-7)',
  'var(--track-8)',
] as const;

const MAX_ASSET_NAME_LENGTH = 10;
const MAX_VISIBLE_ASSETS = 4;
const DEFAULT_TRACK_NAME = 'Track';

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════
const formatPan = (pan: number): string => {
  if (pan === 0) return 'C';
  const pct = Math.round(Math.abs(pan) * 100);
  return pan > 0 ? `R${pct}` : `L${pct}`;
};

const truncateName = (name: string, max: number = MAX_ASSET_NAME_LENGTH): string =>
  name.length > max ? `${name.slice(0, max)}…` : name;

interface TracksPanelProps {
  /** Prefijo para nuevas pistas (i18n) */
  trackNamePrefix?: string;
  /** Confirmar antes de eliminar */
  onBeforeDelete?: (trackId: string) => boolean | Promise<boolean>;
}

/**
 * TracksPanel
 * -----------
 * Panel lateral con listado de pistas (estilo Ableton/DAW clásico).
 *
 * Layout por fila:
 *   [color][#][nombre + M/S/R][pan][vol][meter][assets][×]
 *
 * ✔ Selectores atómicos (no re-render en cascada)
 * ✔ TrackRow memoizado
 * ✔ Handlers estables
 * ✔ Accesible (ARIA + keyboard)
 * ✔ Drag & drop robusto
 * ✔ Confirmación opcional al eliminar
 * ✔ i18n-ready
 */
function TracksPanelBase({
  trackNamePrefix = DEFAULT_TRACK_NAME,
  onBeforeDelete,
}: TracksPanelProps) {
  const dispatch = useAppDispatch();

  // Selectores atómicos
  const trackIds = useAppSelector((s) => s.tracks.allIds);
  const tracksById = useAppSelector((s) => s.tracks.byId);
  const selectedTrackId = useAppSelector((s) => s.tracks.selectedTrackId);
  const assetIds = useAppSelector((s) => s.assets.allIds);
  const assetsById = useAppSelector((s) => s.assets.byId);

  const trackCount = trackIds.length;
  const isEmpty = trackCount === 0;

  // Assets memoizados
  const availableAssets = useMemo(
    () => assetIds.map((aid) => assetsById[aid]).filter(Boolean),
    [assetIds, assetsById]
  );

  // ═══════════════════════════════════
  // Handlers estables
  // ═══════════════════════════════════
  const handleAddTrack = useCallback(() => {
    const nextIdx = trackIds.length;
    dispatch(
      addTrack({
        name: `${trackNamePrefix} ${nextIdx + 1}`,
        type: 'audio',
        color: TRACK_COLORS[nextIdx % TRACK_COLORS.length],
      })
    );
  }, [dispatch, trackIds.length, trackNamePrefix]);

  const handleDropAssetOnTrack = useCallback(
    (assetId: string, trackId: string) => {
      const asset = assetsById[assetId];
      if (!asset) return;

      const action = addClip({
        trackId,
        type: 'audio',
        name: asset.name,
        startTime: 0,
        duration: asset.duration,
        assetId: asset.id,
      });
      dispatch(action);
      dispatch(addClipIdToTrack({ trackId, clipId: action.payload.id }));
    },
    [dispatch, assetsById]
  );

  const handlePlayAsset = useCallback((assetId: string, trackId: string) => {
    const buf = AssetRegistry.get(assetId);
    if (buf) SamplePlayer.play(buf, trackId);
  }, []);

  return (
    <div
      className="tracks-panel"
      role="region"
      aria-label="Panel de pistas"
    >
      {/* ══════════════════════════════════
          HEADER
          ══════════════════════════════════ */}
      <div className="panel-header">
        <span className="panel-title">PISTAS</span>
        <span className="panel-count mono" aria-live="polite">
          {trackCount}
        </span>
        <button
          type="button"
          className="panel-action"
          onClick={handleAddTrack}
          title="Nueva pista (Ctrl+T)"
          aria-label="Añadir nueva pista"
        >
          <Icon name="plus" size={14} />
        </button>
      </div>

      {/* ══════════════════════════════════
          LISTADO
          ══════════════════════════════════ */}
      <div
        className="tracks-scroll"
        role="list"
        aria-label="Lista de pistas"
      >
        {isEmpty ? (
          <div className="empty-state" role="status">
            <Icon name="music" size={32} color="var(--text-dim)" />
            <p>
              No hay pistas.
              <br />
              Añade una para empezar.
            </p>
            <button
              type="button"
              className="btn-primary"
              onClick={handleAddTrack}
            >
              <Icon name="plus" size={14} /> Crear pista
            </button>
          </div>
        ) : (
          trackIds.map((id, idx) => {
            const track = tracksById[id];
            if (!track) return null;

            return (
              <TrackRow
                key={id}
                track={track}
                index={idx}
                selected={selectedTrackId === id}
                availableAssets={availableAssets}
                dispatch={dispatch}
                onDropAsset={handleDropAssetOnTrack}
                onPlayAsset={handlePlayAsset}
                onBeforeDelete={onBeforeDelete}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

export const TracksPanel = memo(TracksPanelBase);

// ═══════════════════════════════════════════
// TRACK ROW (memoizado)
// ═══════════════════════════════════════════

interface TrackRowProps {
  track: Track;
  index: number;
  selected: boolean;
  availableAssets: Array<{ id: string; name: string }>;
  dispatch: ReturnType<typeof useAppDispatch>;
  onDropAsset: (assetId: string, trackId: string) => void;
  onPlayAsset: (assetId: string, trackId: string) => void;
  onBeforeDelete?: (trackId: string) => boolean | Promise<boolean>;
}

function TrackRowBase({
  track,
  index,
  selected,
  availableAssets,
  dispatch,
  onDropAsset,
  onPlayAsset,
  onBeforeDelete,
}: TrackRowProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const trackId = track.id;

  // ═══════════════════════════════════
  // Handlers estables
  // ═══════════════════════════════════
  const handleSelect = useCallback(() => {
    dispatch(selectTrack(trackId));
  }, [dispatch, trackId]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();

      if (onBeforeDelete) {
        const ok = await onBeforeDelete(trackId);
        if (!ok) return;
      }

      dispatch(removeTrack(trackId));
    },
    [dispatch, trackId, onBeforeDelete]
  );

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setTrackVolume({ id: trackId, volume: Number(e.target.value) }));
    },
    [dispatch, trackId]
  );

  const handlePanChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setTrackPan({ id: trackId, pan: Number(e.target.value) }));
    },
    [dispatch, trackId]
  );

  const handleMute = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(toggleMute(trackId));
    },
    [dispatch, trackId]
  );

  const handleSolo = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(toggleSolo(trackId));
    },
    [dispatch, trackId]
  );

  const handleArm = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      dispatch(toggleArm(trackId));
    },
    [dispatch, trackId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSelect();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        // Solo si Ctrl/Cmd + Delete (evita accidentes)
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          handleDelete(e as unknown as React.MouseEvent);
        }
      }
    },
    [handleSelect, handleDelete]
  );

  const stop = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // ═══════════════════════════════════
  // Drag & Drop
  // ═══════════════════════════════════
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();

    // Validar tipos MIME
    const hasAsset =
      e.dataTransfer.types.includes(DRAG_TYPES.ASSET) ||
      e.dataTransfer.types.includes('text/plain');

    if (!hasAsset) return;

    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    // Solo desactivar si salimos del elemento completo
    if (e.currentTarget === e.target) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const assetId =
        e.dataTransfer.getData(DRAG_TYPES.ASSET) ||
        e.dataTransfer.getData('text/plain');

      if (assetId) {
        onDropAsset(assetId, trackId);
      }
    },
    [onDropAsset, trackId]
  );

  // ═══════════════════════════════════
  // Clases
  // ═══════════════════════════════════
  const classes = [
    'track',
    selected && 'selected',
    track.muted && 'muted',
    track.soloed && 'soloed',
    track.armed && 'armed',
    isDragOver && 'drag-over',
  ]
    .filter(Boolean)
    .join(' ');

  const panLabel = formatPan(track.pan);
  const volumePct = Math.round(track.volume * 100);
  const meterHeight = track.muted ? 0 : track.volume * 100;
  const trackNumber = String(index + 1).padStart(2, '0');

  return (
    <div
      className={classes}
      onClick={handleSelect}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="listitem"
      tabIndex={0}
      aria-selected={selected}
      aria-label={`Pista ${index + 1}: ${track.name}`}
    >
      {/* Barra de color */}
      <div
        className="track-color-strip"
        style={{ background: track.color }}
        aria-hidden="true"
      />

      {/* Número */}
      <div className="track-number mono" aria-hidden="true">
        {trackNumber}
      </div>

      {/* Nombre + botones M/S/R */}
      <div className="track-info">
        <div className="track-name" title={track.name}>
          {track.name}
        </div>
        <div className="track-buttons">
          <button
            type="button"
            className={`msr-btn m ${track.muted ? 'active' : ''}`}
            onClick={handleMute}
            aria-pressed={track.muted}
            title={track.muted ? 'Quitar mute' : 'Mute'}
          >
            M
          </button>
          <button
            type="button"
            className={`msr-btn s ${track.soloed ? 'active' : ''}`}
            onClick={handleSolo}
            aria-pressed={track.soloed}
            title={track.soloed ? 'Quitar solo' : 'Solo'}
          >
            S
          </button>
          <button
            type="button"
            className={`msr-btn r ${track.armed ? 'active' : ''}`}
            onClick={handleArm}
            aria-pressed={track.armed}
            title={track.armed ? 'Desarmar' : 'Armar grabación'}
          >
            R
          </button>
        </div>
      </div>

      {/* Pan */}
      <div className="track-pan" onClick={stop}>
        <label className="ctrl-label" htmlFor={`pan-${trackId}`}>
          PAN
        </label>
        <input
          id={`pan-${trackId}`}
          type="range"
          className="pan-slider"
          min={-1}
          max={1}
          step={0.01}
          value={track.pan}
          onChange={handlePanChange}
          aria-label={`${track.name} pan`}
          aria-valuetext={panLabel}
        />
        <span className="ctrl-value mono" aria-hidden="true">
          {panLabel}
        </span>
      </div>

      {/* Volume */}
      <div className="track-volume" onClick={stop}>
        <label className="ctrl-label" htmlFor={`vol-${trackId}`}>
          VOL
        </label>
        <input
          id={`vol-${trackId}`}
          type="range"
          className="volume-slider"
          min={0}
          max={1}
          step={0.01}
          value={track.volume}
          onChange={handleVolumeChange}
          aria-label={`${track.name} volumen`}
          aria-valuetext={`${volumePct}%`}
        />
        <span className="ctrl-value mono" aria-hidden="true">
          {volumePct}
        </span>
      </div>

      {/* Meter visual */}
      <div className="track-meter" aria-hidden="true">
        <div
          className="meter-fill"
          style={{ height: `${meterHeight}%` }}
        />
      </div>

      {/* Assets (preview rápido) */}
      <div className="track-assets" onClick={stop}>
        {availableAssets.length === 0 ? (
          <span className="no-assets">Arrastra un audio →</span>
        ) : (
          availableAssets.slice(0, MAX_VISIBLE_ASSETS).map((a) => (
            <button
              key={a.id}
              type="button"
              className="asset-play-btn"
              onClick={() => onPlayAsset(a.id, trackId)}
              title={`Preview: ${a.name}`}
              aria-label={`Reproducir ${a.name}`}
            >
              <Icon name="play" size={10} />
              <span>{truncateName(a.name)}</span>
            </button>
          ))
        )}
      </div>

      {/* Delete */}
      <button
        type="button"
        className="track-delete"
        onClick={handleDelete}
        title={`Eliminar ${track.name}`}
        aria-label={`Eliminar pista ${track.name}`}
      >
        <Icon name="trash" size={14} />
      </button>
    </div>
  );
}

const TrackRow = memo(TrackRowBase);