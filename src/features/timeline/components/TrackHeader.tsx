// src/features/timeline/components/TrackHeader.tsx

import {
  memo,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { useAppSelector, useAppDispatch } from '@state/store';
import { useMixerChannel } from '@state/hooks/useMixerChannel';
import {
  openFxBrowser,
  toggleFxChainWindow,
} from '@state/slices/ui/uiSlice';
import {
  selectFxChainByOwnerId,
} from '@state/slices/fxChains/fxChainsSlice';
import { PanKnob } from '@shared/components/PanKnob';
import {
  linearToDb,
  dbToLinear,
  DB_MIN,
  DB_MAX,
  UNITY_LINEAR,
} from '@shared/utils/dBConversion';
import { TrackResizeHandle } from './TrackResizeHandle';
import './TrackHeader.css';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface TrackHeaderProps {
  trackId: string;
  index: number;
  height: number;
  onRename?: (trackId: string, newName: string) => void;
  onContextMenu?: (trackId: string, e: React.MouseEvent) => void;
  onVolumeCommitted?: (trackId: string, value: number) => void;
  onPanCommitted?: (trackId: string, value: number) => void;
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

type TrackHeaderStyle = CSSProperties & {
  '--track-color': string;
};

const SILENCE_THRESHOLD = 0.001;

function normalizeTrackName(name: string): string {
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : 'Untitled Track';
}

function clampKnob(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function volumeToKnobValue(volume: number): number {
  if (volume <= 0) return -1;
  const db = linearToDb(volume);
  if (!Number.isFinite(db)) return -1;
  if (db >= 0) return Math.min(1, db / DB_MAX);
  return Math.max(-1, db / -DB_MIN);
}

function knobValueToVolume(knobValue: number): number {
  const knob = clampKnob(knobValue);
  if (knob === 0) return UNITY_LINEAR;
  const db = knob >= 0 ? knob * DB_MAX : knob * -DB_MIN;
  return dbToLinear(db);
}

function buildVolumeDisplayValue(volume: number, dbLabel: string): string {
  return volume <= SILENCE_THRESHOLD ? '-∞' : dbLabel;
}

function buildVolumeAriaValueText(volume: number, dbLabel: string): string {
  return volume <= SILENCE_THRESHOLD ? '-∞ dB' : `${dbLabel} dB`;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

function TrackHeaderBase({
  trackId,
  index,
  height,
  onRename,
  onContextMenu,
  onVolumeCommitted,
  onPanCommitted,
}: TrackHeaderProps) {
  const dispatch = useAppDispatch();

  const { track, isSelected, dbLabel, handlers } = useMixerChannel(trackId, {
    onVolumeCommitted,
    onPanCommitted,
  });

  // 🔴 Estado global de grabación
  const isRecording = useAppSelector((s) => s.transport.isRecording);

  // 🎛️ FX Chain de esta track (para saber si tiene plugins)
  const fxChain = useAppSelector((s) => selectFxChainByOwnerId(s, trackId));
  const hasFxPlugins = (fxChain?.plugins.length ?? 0) > 0;

  const [isEditingName, setIsEditingName] = useState(false);
  const [editValue, setEditValue] = useState('');

  // ═══════════════════════════════════
  // Derivados memoizados
  // ═══════════════════════════════════

  const isRecordingThis = Boolean(track?.armed && isRecording);

  const className = useMemo(
    () =>
      [
        'rpr-track',
        `is-${track?.type}`,
        isSelected && 'is-selected',
        track?.muted && 'is-muted',
        track?.soloed && 'is-soloed',
        track?.armed && 'is-armed',
        isRecordingThis && 'is-recording',
      ]
        .filter(Boolean)
        .join(' '),
    [track?.type, track?.muted, track?.soloed, track?.armed, isSelected, isRecordingThis]
  );

  const rootStyle = useMemo<TrackHeaderStyle>(
    () => ({
      height,
      '--track-color': track?.color ?? '#888',
    }),
    [height, track?.color]
  );

  const ariaLabel = useMemo(() => {
    if (!track) return `Pista ${index + 1}`;
    const parts = [`Pista ${index + 1}: ${track.name}`];
    if (isRecordingThis) parts.push('grabando');
    else if (track.armed) parts.push('armada');
    if (track.muted) parts.push('silenciada');
    if (track.soloed) parts.push('en solo');
    if (isSelected) parts.push('seleccionada');
    return parts.join(', ');
  }, [index, track, isSelected, isRecordingThis]);

  const volumeKnobValue = useMemo(
    () => volumeToKnobValue(track?.volume ?? 1),
    [track?.volume]
  );

  const volumeDisplayValue = useMemo(
    () => buildVolumeDisplayValue(track?.volume ?? 1, dbLabel),
    [track?.volume, dbLabel]
  );

  const volumeAriaValueText = useMemo(
    () => buildVolumeAriaValueText(track?.volume ?? 1, dbLabel),
    [track?.volume, dbLabel]
  );

  const volumeAriaValueNow = useMemo(
    () => Math.round((volumeKnobValue + 1) * 50),
    [volumeKnobValue]
  );

  // ═══════════════════════════════════
  // Helpers de eventos
  // ═══════════════════════════════════

  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const handleSelect = useCallback(() => {
    if (isEditingName) return;
    handlers.onSelect();
  }, [handlers, isEditingName]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (!onContextMenu) return;
      e.preventDefault();
      onContextMenu(trackId, e);
    },
    [onContextMenu, trackId]
  );

  const beginEditing = useCallback(() => {
    if (!onRename || !track) return;
    setEditValue(track.name);
    setIsEditingName(true);
  }, [onRename, track]);

  const handleRootKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (isEditingName) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlers.onSelect();
        return;
      }
      if (e.key === 'F2' && onRename) {
        e.preventDefault();
        beginEditing();
      }
    },
    [handlers, isEditingName, onRename, beginEditing]
  );

  const inputCallbackRef = useCallback((node: HTMLInputElement | null) => {
    if (!node) return;
    node.focus();
    node.select();
  }, []);

  const startEditing = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      beginEditing();
    },
    [beginEditing]
  );

  const commitEdit = useCallback(() => {
    if (!onRename || !track) {
      setIsEditingName(false);
      return;
    }
    const nextName = normalizeTrackName(editValue);
    if (nextName !== track.name) onRename(trackId, nextName);
    setIsEditingName(false);
  }, [editValue, onRename, track, trackId]);

  const cancelEdit = useCallback(() => {
    setEditValue(track?.name ?? '');
    setIsEditingName(false);
  }, [track?.name]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      e.stopPropagation();
      if (e.key === 'Enter') commitEdit();
      else if (e.key === 'Escape') cancelEdit();
    },
    [commitEdit, cancelEdit]
  );

  const handleEditChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value),
    []
  );

  const handleHeaderVolumeChange = useCallback(
    (knobValue: number) => handlers.onVolumeChange(knobValueToVolume(knobValue)),
    [handlers]
  );

  const handleHeaderVolumeCommit = useCallback(
    (knobValue: number) => handlers.onVolumeCommit(knobValueToVolume(knobValue)),
    [handlers]
  );

  const handleHeaderVolumeReset = useCallback(
    () => handlers.onVolumeReset(),
    [handlers]
  );

  const handleToggleArm = useCallback(
    (e: React.MouseEvent) => { stopPropagation(e); handlers.onToggleArm(); },
    [stopPropagation, handlers]
  );

  const handleToggleMute = useCallback(
    (e: React.MouseEvent) => { stopPropagation(e); handlers.onToggleMute(); },
    [stopPropagation, handlers]
  );

  const handleToggleSolo = useCallback(
    (e: React.MouseEvent) => { stopPropagation(e); handlers.onToggleSolo(); },
    [stopPropagation, handlers]
  );

  /**
   * Lógica del botón FX (opción C acordada):
   *   - Si la track ya tiene plugins → toggle FX Chain window
   *   - Si no tiene plugins → abrir FX Browser para añadir el primero
   */
  const handleFxClick = useCallback(
    (e: React.MouseEvent) => {
      stopPropagation(e);
      if (hasFxPlugins) {
        dispatch(toggleFxChainWindow(trackId));
      } else {
        dispatch(openFxBrowser(trackId));
      }
    },
    [stopPropagation, dispatch, trackId, hasFxPlugins]
  );

  const handlePowerClick = useCallback(
    (e: React.MouseEvent) => { stopPropagation(e); },
    [stopPropagation]
  );

  const handleTrimClick = useCallback(
    (e: React.MouseEvent) => { stopPropagation(e); },
    [stopPropagation]
  );

  const handleTrimDoubleClick = useCallback(
    (e: React.MouseEvent) => { stopPropagation(e); handlers.onVolumeReset(); },
    [stopPropagation, handlers]
  );

  const handlePanWrapperClick = useCallback(
    (e: React.MouseEvent) => { stopPropagation(e); },
    [stopPropagation]
  );

  // Early return — DESPUÉS de todos los hooks
  if (!track) return null;

  // ═══════════════════════════════════
  // Render
  // ═══════════════════════════════════
  return (
    <div
      className={className}
      style={rootStyle}
      onClick={handleSelect}
      onKeyDown={handleRootKeyDown}
      onContextMenu={handleContextMenu}
      tabIndex={0}
      role="group"
      aria-label={ariaLabel}
      data-track-id={trackId}
      data-selected={isSelected ? 'true' : 'false'}
    >
      <div className="rpr-track-num mono" aria-hidden="true">
        {index + 1}
      </div>

      <div className="rpr-track-body">
        <div className="rpr-track-row-top">
          <button
            type="button"
            className={`rpr-btn-rec ${track.armed ? 'active' : ''}`}
            onClick={handleToggleArm}
            aria-pressed={track.armed}
            title={track.armed ? 'Desarmar grabación' : 'Armar grabación'}
            aria-label={track.armed ? 'Desarmar grabación' : 'Armar grabación'}
          >
            <span className="rpr-rec-dot" />
          </button>

          <div
            className="rpr-track-namebar"
            onDoubleClick={onRename ? startEditing : undefined}
            title={
              isEditingName
                ? undefined
                : onRename
                  ? 'Doble clic para renombrar · F2'
                  : track.name
            }
          >
            {isEditingName ? (
              <input
                ref={inputCallbackRef}
                type="text"
                className="rpr-track-name-input"
                value={editValue}
                onChange={handleEditChange}
                onBlur={commitEdit}
                onKeyDown={handleEditKeyDown}
                onClick={stopPropagation}
                aria-label="Nombre de la pista"
                spellCheck={false}
              />
            ) : (
              <span className="rpr-track-name">{track.name}</span>
            )}
          </div>

          <div className="rpr-track-pan" onClick={handlePanWrapperClick}>
            <PanKnob
              value={volumeKnobValue}
              onChange={handleHeaderVolumeChange}
              onCommit={handleHeaderVolumeCommit}
              onDoubleClick={handleHeaderVolumeReset}
              size={18}
              label={`${track.name} volumen`}
              valueText={volumeDisplayValue}
              ariaValueText={volumeAriaValueText}
              ariaValueMin={0}
              ariaValueMax={100}
              ariaValueNow={volumeAriaValueNow}
            />
          </div>
        </div>

        <div className="rpr-track-row-mid">
          <button
            type="button"
            className={`rpr-mini-btn btn-m ${track.muted ? 'active' : ''}`}
            onClick={handleToggleMute}
            aria-pressed={track.muted}
            title={track.muted ? 'Quitar mute' : 'Silenciar'}
            aria-label={track.muted ? 'Quitar mute' : 'Silenciar pista'}
          >
            M
          </button>

          <button
            type="button"
            className={`rpr-mini-btn btn-s ${track.soloed ? 'active' : ''}`}
            onClick={handleToggleSolo}
            aria-pressed={track.soloed}
            title={track.soloed ? 'Quitar solo' : 'Solo'}
            aria-label={track.soloed ? 'Quitar solo' : 'Poner solo'}
          >
            S
          </button>

          {/*
           * Botón FX — lógica C:
           *   tiene plugins → toggle ventana FX Chain
           *   sin plugins   → abre FX Browser
           * La clase btn-fx--active indica que la chain tiene plugins.
           */}
          <button
            type="button"
            className={`rpr-mini-btn btn-fx ${hasFxPlugins ? 'btn-fx--active' : ''}`}
            onClick={handleFxClick}
            title={
              hasFxPlugins
                ? 'Ver/ocultar cadena de efectos'
                : 'Añadir efecto a la track'
            }
            aria-label={
              hasFxPlugins
                ? 'Ver/ocultar cadena de efectos'
                : 'Añadir efecto a la track'
            }
          >
            FX
          </button>

          <button
            type="button"
            className="rpr-mini-btn btn-power"
            onClick={handlePowerClick}
            title="Bypass del canal"
            aria-label="Bypass del canal"
          >
            <svg viewBox="0 0 10 10" width="7" height="7" aria-hidden="true">
              <path
                d="M5 1 V 5 M2.5 2.5 A 3.5 3.5 0 1 0 7.5 2.5"
                stroke="currentColor"
                strokeWidth="1.3"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </button>

          <div
            className="rpr-track-meter"
            aria-label="Medidor de nivel"
            aria-hidden="true"
          >
            <div className="rpr-meter-bar" />
            <div className="rpr-meter-bar" />
          </div>
        </div>

        <div className="rpr-track-row-bottom">
          <button
            type="button"
            className="rpr-trim-btn"
            onClick={handleTrimClick}
            onDoubleClick={handleTrimDoubleClick}
            title="Trim / envolvente (doble clic = reset volumen)"
            aria-label="Trim de automation"
          >
            <svg viewBox="0 0 14 8" width="6" height="4" aria-hidden="true">
              <path
                d="M1 6 L4.5 2.5 L8 5 L13 1.5"
                stroke="currentColor"
                strokeWidth="1.6"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>TRIM</span>
          </button>
        </div>
      </div>

      <div className="rpr-track-color" aria-hidden="true" />
      <TrackResizeHandle trackId={trackId} />
    </div>
  );
}

export const TrackHeader = memo(TrackHeaderBase);