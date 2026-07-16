// src/features/transport/components/BottomBar.tsx

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  play,
  pause,
  stopAndRewind,
  setEditCursor,
  toggleRecord,
  toggleLoop,
} from '@state/slices/transport/transportSlice';
import { Icon } from '@shared/components/Icon';

import './BottomBar.css';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

interface TimeSignatureLike {
  numerator: number;
  denominator: number;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const TICKS_PER_BEAT = 100;

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * BPM se interpreta como negras por minuto.
 * Si el compás es 7/8, cada beat del BBT dura:
 *   quarterNoteSeconds * (4 / denominator)
 */
function getBeatUnitSeconds(
  bpm: number,
  sig: TimeSignatureLike
): number {
  const quarterNoteSeconds = 60 / bpm;
  return quarterNoteSeconds * (4 / sig.denominator);
}

function getBarDurationSeconds(
  bpm: number,
  sig: TimeSignatureLike
): number {
  return sig.numerator * getBeatUnitSeconds(bpm, sig);
}

function getNextBarStartSeconds(
  currentSeconds: number,
  bpm: number,
  sig: TimeSignatureLike
): number {
  const secondsPerBar = getBarDurationSeconds(bpm, sig);
  const currentBar = Math.floor(currentSeconds / secondsPerBar);
  return (currentBar + 1) * secondsPerBar;
}

function formatBBT(
  seconds: number,
  bpm: number,
  sig: TimeSignatureLike
): string {
  const secondsPerBeat = getBeatUnitSeconds(bpm, sig);
  const totalBeats = Math.max(0, seconds) / secondsPerBeat;

  const bar = Math.floor(totalBeats / sig.numerator) + 1;
  const beat = Math.floor(totalBeats % sig.numerator) + 1;
  const tick = Math.floor((totalBeats % 1) * TICKS_PER_BEAT);

  return `${bar}.${beat}.${tick.toString().padStart(2, '0')}`;
}

function formatTime(seconds: number): string {
  const clamped = Math.max(0, seconds);
  const m = Math.floor(clamped / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.floor((clamped % 1) * 1000);

  return `${m}:${s.toString().padStart(2, '0')}.${ms
    .toString()
    .padStart(3, '0')}`;
}

function formatDuration(
  seconds: number,
  bpm: number,
  sig: TimeSignatureLike
): string {
  if (seconds <= 0) return '0.0.00';

  const secondsPerBeat = getBeatUnitSeconds(bpm, sig);
  const totalBeats = seconds / secondsPerBeat;

  const bars = Math.floor(totalBeats / sig.numerator);
  const beats = Math.floor(totalBeats % sig.numerator);
  const ticks = Math.floor((totalBeats % 1) * TICKS_PER_BEAT);

  return `${bars}.${beats}.${ticks.toString().padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * BottomBar — estilo REAPER profesional
 * --------------------------------------
 * Transport compacto + información musical (BBT / tiempo / selection / signature / BPM)
 */
export function BottomBar() {
  const dispatch = useAppDispatch();

  // ─── Selectores atómicos ────────────────────────────────────
  const isPlaying = useAppSelector((s) => s.transport.isPlaying);
  const isRecording = useAppSelector((s) => s.transport.isRecording);
  const editCursorSeconds = useAppSelector((s) => s.transport.editCursorSeconds);
  const playheadSeconds = useAppSelector((s) => s.transport.playheadSeconds);
  const loopEnabled = useAppSelector((s) => s.transport.loopEnabled);
  const loopStart = useAppSelector((s) => s.transport.loopStart);
  const loopEnd = useAppSelector((s) => s.transport.loopEnd);

  const bpm = useAppSelector((s) => s.project.current.bpm);
  const timeSignature = useAppSelector((s) => s.project.current.timeSignature);

  // ─── Derivados ──────────────────────────────────────────────
  const currentSec = isPlaying ? playheadSeconds : editCursorSeconds;
  const hasValidLoopRange = loopEnd > loopStart;
  const selectionActive = loopEnabled && hasValidLoopRange;

  const stateLabel = isRecording
    ? '[Recording]'
    : isPlaying
      ? '[Playing]'
      : '[Stopped]';

  const stateClass = isRecording
    ? 'is-rec'
    : isPlaying
      ? 'is-play'
      : '';

  const selectionStartLabel = selectionActive
    ? formatBBT(loopStart, bpm, timeSignature)
    : '--.--.--';

  const selectionEndLabel = selectionActive
    ? formatBBT(loopEnd, bpm, timeSignature)
    : '--.--.--';

  const selectionLengthLabel = selectionActive
    ? formatDuration(loopEnd - loopStart, bpm, timeSignature)
    : '0.0.00';

  // ─── Handlers de transport ─────────────────────────────────
  const handlePrev = useCallback(() => {
    dispatch(setEditCursor(0));
  }, [dispatch]);

  const handleNext = useCallback(() => {
    const nextBarStart = getNextBarStartSeconds(
      editCursorSeconds,
      bpm,
      timeSignature
    );
    dispatch(setEditCursor(nextBarStart));
  }, [dispatch, editCursorSeconds, bpm, timeSignature]);

  const handleRecord = useCallback(() => {
    dispatch(toggleRecord());
  }, [dispatch]);

  const handlePlay = useCallback(() => {
    if (!isPlaying) {
      dispatch(play());
    }
  }, [dispatch, isPlaying]);

  const handleStop = useCallback(() => {
    dispatch(stopAndRewind());
  }, [dispatch]);

  const handlePause = useCallback(() => {
    if (isPlaying) {
      dispatch(pause());
    }
  }, [dispatch, isPlaying]);

  const handleLoop = useCallback(() => {
    dispatch(toggleLoop());
  }, [dispatch]);

  return (
    <footer className="rpr-bottombar" role="contentinfo">
      {/* ═══ ZONA 1: TRANSPORT COMPACTO ═══ */}
      <div className="rpr-bb-transport" role="toolbar" aria-label="Transporte inferior">
        <button
          className="rpr-bb-btn"
          onClick={handlePrev}
          title="Ir al inicio (Home)"
          aria-label="Ir al inicio"
        >
          <Icon name="skip-back" size={12} />
        </button>

        <button
          className="rpr-bb-btn"
          onClick={handleNext}
          title="Siguiente compás"
          aria-label="Ir al siguiente compás"
        >
          <Icon name="skip-forward" size={12} />
        </button>

        <button
          className={`rpr-bb-btn rpr-bb-rec${isRecording ? ' active' : ''}`}
          onClick={handleRecord}
          title="Grabar (R)"
          aria-label={isRecording ? 'Detener grabación' : 'Grabar'}
          aria-pressed={isRecording}
        >
          <Icon name="record" size={12} />
        </button>

        <button
          className={`rpr-bb-btn rpr-bb-play${isPlaying ? ' active' : ''}`}
          onClick={handlePlay}
          title="Play (Space)"
          aria-label="Reproducir"
          aria-pressed={isPlaying}
          disabled={isPlaying}
        >
          <Icon name="play" size={13} />
        </button>

        <button
          className="rpr-bb-btn rpr-bb-stop"
          onClick={handleStop}
          title="Stop"
          aria-label="Detener y volver al inicio"
        >
          <Icon name="stop" size={12} />
        </button>

        <button
          className="rpr-bb-btn"
          onClick={handlePause}
          title="Pause"
          aria-label="Pausar"
          disabled={!isPlaying}
        >
          <Icon name="pause" size={12} />
        </button>

        <button
          className={`rpr-bb-btn${loopEnabled ? ' active' : ''}`}
          onClick={handleLoop}
          title="Loop (L)"
          aria-label={loopEnabled ? 'Desactivar loop' : 'Activar loop'}
          aria-pressed={loopEnabled}
        >
          <Icon name="loop" size={12} />
        </button>
      </div>

      {/* ═══ ZONA 2: TIEMPO ACTUAL (BBT / MM:SS.ms) ═══ */}
      <div className="rpr-bb-time-block" aria-label="Tiempo actual">
        <span className="rpr-bb-time-bbt mono">
          {formatBBT(currentSec, bpm, timeSignature)}
        </span>
        <span className="rpr-bb-time-sep" aria-hidden="true">/</span>
        <span className="rpr-bb-time-abs mono">
          {formatTime(currentSec)}
        </span>
      </div>

      {/* ═══ ZONA 3: ESTADO ═══ */}
      <div className="rpr-bb-state" aria-live="polite">
        <span className={`rpr-bb-state-label ${stateClass}`}>
          {stateLabel}
        </span>
      </div>

      {/* ═══ ZONA 4: SELECTION (loop / rango) ═══ */}
      <div
        className={`rpr-bb-selection${selectionActive ? '' : ' is-empty'}`}
        aria-label="Rango de selección"
        title={selectionActive ? 'Rango de loop activo' : 'Sin loop activo'}
      >
        <span className="rpr-bb-sel-lbl">Selection:</span>
        <span className="rpr-bb-sel-val mono">{selectionStartLabel}</span>
        <span className="rpr-bb-sel-val mono">{selectionEndLabel}</span>
        <span className="rpr-bb-sel-val mono rpr-bb-sel-len">
          {selectionLengthLabel}
        </span>
      </div>

      {/* ═══ ZONA 5: TIME SIGNATURE ═══ */}
      <div
        className="rpr-bb-sig mono"
        aria-label={`Compás ${timeSignature.numerator} por ${timeSignature.denominator}`}
      >
        {timeSignature.numerator}/{timeSignature.denominator}
      </div>

      {/* ═══ ZONA 6: BPM ═══ */}
      <div className="rpr-bb-bpm" aria-label={`Tempo ${bpm} BPM`}>
        <span className="rpr-bb-bpm-icon" aria-hidden="true">♪=</span>
        <span className="rpr-bb-bpm-val mono">{bpm}</span>
      </div>

      {/* ═══ ZONA 7: GLOBAL SETTINGS ═══ */}
      <div className="rpr-bb-global" aria-label="Estado global">
        <span className="rpr-bb-global-lbl">GLOBAL</span>
        <span className="rpr-bb-global-val">OFF</span>
      </div>

      {/* ═══ ZONA 8: RATE ═══ */}
      <div className="rpr-bb-rate" aria-label="Velocidad de reproducción">
        <span className="rpr-bb-rate-lbl">Rate:</span>
        <span className="rpr-bb-rate-val mono">1.0</span>
      </div>
    </footer>
  );
}