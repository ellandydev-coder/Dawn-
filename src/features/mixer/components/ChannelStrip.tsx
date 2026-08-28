// src/features/mixer/components/ChannelStrip.tsx

import { memo, useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  openFxBrowser,
  toggleFxChainWindow,
} from '@state/slices/ui/uiSlice';
import { selectFxChainByOwnerId } from '@state/slices/fxChains/fxChainsSlice';
import { FaderControl } from './FaderControl';
import { PanKnob } from '@shared/components/PanKnob';
import { useMixerChannel } from '@state/hooks/useMixerChannel';
import './ChannelStrip.css';

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════

const FADER_HEIGHT = 128;

// ═══════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════

export interface ChannelStripProps {
  trackId: string;
  channelNumber?: number;
  /** Callback opcional al eliminar (para confirmaciones externas) */
  onBeforeDelete?: (trackId: string) => boolean | Promise<boolean>;
  /** Callback opcional tras commit de volumen (undo/redo) */
  onVolumeCommitted?: (trackId: string, value: number) => void;
  /** Callback opcional tras commit de pan (undo/redo) */
  onPanCommitted?: (trackId: string, value: number) => void;
}

/**
 * ChannelStrip (rediseño estilo REAPER compacto)
 * ----------------------------------------------
 * Layout vertical:
 *   [ Pan knob ]
 *   [ -inf dB display ]
 *   [ Fader | col derecha: M, S, sends-indicator, FX, bypass ]
 *   [ Speaker · REC ]
 *   [ Nº canal ]
 *
 * Click en zona vacía = seleccionar canal
 * Click derecho (context menu futuro) = delete/rename/etc.
 * Tooltip del canal muestra el nombre completo
 *
 * ✔ onCommit conectado en fader y pan para undo/redo por gesto
 * ✔ Delete delegado al hook (que maneja onBeforeDelete internamente)
 * ✔ FX button: toggle chain si tiene plugins, abre browser si no
 */
function ChannelStripBase({
  trackId,
  channelNumber,
  onBeforeDelete,
  onVolumeCommitted,
  onPanCommitted,
}: ChannelStripProps) {
  const dispatch = useAppDispatch();

  const { track, isSelected, dbLabel, handlers } = useMixerChannel(trackId, {
    onBeforeDelete,
    onVolumeCommitted,
    onPanCommitted,
  });

  // ─── FX chain state (misma lógica que TrackHeader) ──
  const fxChain = useAppSelector((s) => selectFxChainByOwnerId(s, trackId));
  const hasFxPlugins = (fxChain?.plugins.length ?? 0) > 0;

  // ─── Handlers estables ──────────────────

  const stopPropagation = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation();
  }, []);

  const handleDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      await handlers.onRemove();
    },
    [handlers]
  );

  const handleRootClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        handlers.onSelect();
      }
    },
    [handlers]
  );

  const handleRootKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.target !== e.currentTarget) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handlers.onSelect();
      }
    },
    [handlers]
  );

  const handleToggleMute = useCallback(
    (e: React.MouseEvent) => {
      stopPropagation(e);
      handlers.onToggleMute();
    },
    [stopPropagation, handlers]
  );

  const handleToggleSolo = useCallback(
    (e: React.MouseEvent) => {
      stopPropagation(e);
      handlers.onToggleSolo();
    },
    [stopPropagation, handlers]
  );

  const handleToggleArm = useCallback(
    (e: React.MouseEvent) => {
      stopPropagation(e);
      handlers.onToggleArm();
    },
    [stopPropagation, handlers]
  );

  /**
   * FX click — misma lógica C que TrackHeader:
   *   tiene plugins → toggle FX Chain window
   *   sin plugins   → abre FX Browser
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

  // ─── Derivados memoizados ───────────────

  const className = useMemo(
    () =>
      [
        'chstrip',
        isSelected && 'is-selected',
        track?.muted && 'is-muted',
        track?.soloed && 'is-soloed',
        track?.armed && 'is-armed',
      ]
        .filter(Boolean)
        .join(' '),
    [isSelected, track?.muted, track?.soloed, track?.armed]
  );

  const ariaLabel = useMemo(() => {
    if (!track) return '';
    const parts = [`Canal ${channelNumber ?? ''}`, track.name];
    if (track.muted) parts.push('silenciado');
    if (track.soloed) parts.push('en solo');
    if (track.armed) parts.push('armado');
    if (isSelected) parts.push('seleccionado');
    return parts.filter(Boolean).join(' — ');
  }, [channelNumber, track, isSelected]);

  const volumeText = useMemo(
    () => (track && track.volume <= 0.001 ? '-inf' : dbLabel),
    [track, dbLabel]
  );

  // ─── Early return ───────────────────────

  if (!track) return null;

  return (
    <div
      className={className}
      role="group"
      aria-label={ariaLabel}
      title={track.name}
      onClick={handleRootClick}
      onKeyDown={handleRootKeyDown}
      tabIndex={0}
    >
      {/* ═══ Pan knob arriba ═══ */}
      <div className="chstrip-pan-wrap" onPointerDown={stopPropagation}>
        <PanKnob
          value={track.pan}
          onChange={handlers.onPanChange}
          onCommit={handlers.onPanCommit}
          onDoubleClick={handlers.onPanReset}
          size={22}
          label={`${track.name} pan`}
        />
      </div>

      {/* ═══ Display dB compacto ═══ */}
      <div className="chstrip-db-mini mono" aria-label={`Volumen: ${volumeText}`}>
        {volumeText}
      </div>

      {/* ═══ Cuerpo principal: Fader | Columna derecha ═══ */}
      <div className="chstrip-body">
        <div className="chstrip-fader-wrap">
          <FaderControl
            value={track.volume}
            onChange={handlers.onVolumeChange}
            onCommit={handlers.onVolumeCommit}
            onDoubleClick={handlers.onVolumeReset}
            height={FADER_HEIGHT}
            label={`${track.name} volumen`}
          />
        </div>

        {/* Columna derecha: M, S, sends-indicator, FX, bypass */}
        <div className="chstrip-side-col" onPointerDown={stopPropagation}>
          <button
            type="button"
            className={`chstrip-side-btn btn-m${track.muted ? ' active' : ''}`}
            onClick={handleToggleMute}
            aria-pressed={track.muted}
            aria-label={track.muted ? 'Quitar mute' : 'Silenciar'}
            title={track.muted ? 'Quitar mute (M)' : 'Silenciar (M)'}
          >
            M
          </button>

          <button
            type="button"
            className={`chstrip-side-btn btn-s${track.soloed ? ' active' : ''}`}
            onClick={handleToggleSolo}
            aria-pressed={track.soloed}
            aria-label={track.soloed ? 'Quitar solo' : 'Solo'}
            title={track.soloed ? 'Quitar solo (S)' : 'Solo (S)'}
          >
            S
          </button>

          {/* Franja diagonal decorativa (placeholder para sends/routing) */}
          <div
            className="chstrip-sends-indicator"
            aria-hidden="true"
            title="Sends / routing"
          />

          <button
            type="button"
            className={`chstrip-side-btn btn-fx${hasFxPlugins ? ' btn-fx--active' : ''}`}
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
            className="chstrip-side-btn btn-bypass"
            onClick={stopPropagation}
            title="Bypass del canal"
            aria-label="Bypass del canal"
          >
            <svg viewBox="0 0 10 10" width="8" height="8" aria-hidden="true">
              <path
                d="M5 1 V 5 M2.5 2.5 A 3.5 3.5 0 1 0 7.5 2.5"
                stroke="currentColor"
                strokeWidth="1.4"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* ═══ Fila inferior: Speaker + REC ═══ */}
      <div className="chstrip-bottom-row" onPointerDown={stopPropagation}>
        <button
          type="button"
          className="chstrip-speaker-btn"
          onClick={handleDelete}
          title={`Eliminar ${track.name}`}
          aria-label={`Eliminar ${track.name}`}
        >
          <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden="true">
            <path
              d="M2 4.5 V 7.5 H 4 L 7 10 V 2 L 4 4.5 Z"
              fill="currentColor"
            />
            <path
              d="M8.5 4 L 10.5 6 M 10.5 4 L 8.5 6"
              stroke="currentColor"
              strokeWidth="1"
              strokeLinecap="round"
            />
          </svg>
        </button>

        <button
          type="button"
          className={`chstrip-rec-btn${track.armed ? ' active' : ''}`}
          onClick={handleToggleArm}
          aria-pressed={track.armed}
          aria-label={track.armed ? 'Desarmar grabación' : 'Armar grabación'}
          title={track.armed ? 'Desarmar' : 'Armar grabación'}
        >
          <span className="chstrip-rec-dot" />
        </button>
      </div>

      {/* ═══ Footer: número de canal ═══ */}
      <div className="chstrip-footer">
        <span className="chstrip-num mono">{channelNumber ?? ''}</span>
      </div>
    </div>
  );
}

export const ChannelStrip = memo(ChannelStripBase);