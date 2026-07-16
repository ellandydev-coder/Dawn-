// src/features/transport/components/TopBar.tsx

import { useCallback, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  play,
  pause,
  stopAndRewind,
  setEditCursor,
  toggleLoop,
  toggleMetronome,
  toggleRecord,
} from '@state/slices/transport/transportSlice';
import {
  setBpm,
  nudgeBpm,
  renameProject,
} from '@state/slices/project/projectSlice';
import {
  setMasterVolume,
  toggleMasterMute,
} from '@state/slices/mixer/mixerSlice';
import {
  toggleShortcutsOverlay,
  togglePreferences,
} from '@state/slices/ui/uiSlice';
import { Icon } from '@shared/components/Icon';
import { MenuIcon, LogoIcon } from '@shared/components/icons';
import { InputDeviceSelector } from './InputDeviceSelector';

import './Topbar.css';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const MIN_BPM = 20;
const MAX_BPM = 999;
const MIN_VOLUME = 0;
const MAX_VOLUME = 1;
const VOLUME_STEP = 0.01;
const BPM_NUDGE_STEP = 1;
const MINUS_INFINITY_LABEL = '-∞ dB';

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  const d = Math.floor((seconds % 1) * 10);
  return `${m}:${s}.${d}`;
}

function formatDb(volume: number): string {
  if (volume <= 0) return MINUS_INFINITY_LABEL;
  return `${(20 * Math.log10(volume)).toFixed(1)} dB`;
}

function formatLastSaved(modifiedAt: number | null): string {
  if (!modifiedAt) return 'Nunca';
  const diff = Date.now() - modifiedAt;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'Ahora';
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return new Date(modifiedAt).toLocaleDateString();
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ TOPBAR
// ═══════════════════════════════════════════════════════════════

export function TopBar() {
  const dispatch = useAppDispatch();

  // ─── Selectores atómicos ────────────────────────────────────
  const isPlaying     = useAppSelector((s) => s.transport.isPlaying);
  const isRecording   = useAppSelector((s) => s.transport.isRecording);
  const loopEnabled   = useAppSelector((s) => s.transport.loopEnabled);
  const metronomeOn   = useAppSelector((s) => s.transport.metronomeEnabled);
  const playheadSec   = useAppSelector((s) => s.transport.playheadSeconds);
  const editCursorSec = useAppSelector((s) => s.transport.editCursorSeconds);

  const bpm           = useAppSelector((s) => s.project.current.bpm);
  const timeSignature = useAppSelector((s) => s.project.current.timeSignature);
  const projectName   = useAppSelector((s) => s.project.current.name);
  const modifiedAt    = useAppSelector((s) => s.project.current.modifiedAt);
  const isDirty       = useAppSelector((s) => s.project.isDirty);

  const masterVolume  = useAppSelector((s) => s.mixer.global.masterVolume);
  const masterMuted   = useAppSelector((s) => s.mixer.global.masterMuted);

  // 👇 Nuevo: saber si Preferences está abierta (para aria-expanded del botón ☰)
  const preferencesOpen = useAppSelector((s) => s.ui.showPreferences);

  // ─── Refs ───────────────────────────────────────────────────
  const bpmInputRef = useRef<HTMLInputElement>(null);

  // ─── Tiempo mostrado ────────────────────────────────────────
  const displayTime = isPlaying ? playheadSec : editCursorSec;

  // ═══════════════════════════════════════════════════════════
  // HANDLERS — TRANSPORT
  // ═══════════════════════════════════════════════════════════

  const handlePlayPause = useCallback(() => {
    dispatch(isPlaying ? pause() : play());
  }, [dispatch, isPlaying]);

  const handleGoToStart = useCallback(() => {
    dispatch(setEditCursor(0));
  }, [dispatch]);

  const handleStopFull = useCallback(() => {
    dispatch(stopAndRewind());
  }, [dispatch]);

  const handleToggleRecord = useCallback(() => {
    dispatch(toggleRecord());
  }, [dispatch]);

  const handleToggleLoop = useCallback(() => {
    dispatch(toggleLoop());
  }, [dispatch]);

  const handleToggleMetronome = useCallback(() => {
    dispatch(toggleMetronome());
  }, [dispatch]);

  // ═══════════════════════════════════════════════════════════
  // HANDLERS — BPM
  // ═══════════════════════════════════════════════════════════

  const handleBpmChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      if (!isNaN(val)) dispatch(setBpm(val));
    },
    [dispatch]
  );

  const handleBpmKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        dispatch(nudgeBpm(BPM_NUDGE_STEP));
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        dispatch(nudgeBpm(-BPM_NUDGE_STEP));
      } else if (e.key === 'Enter') {
        bpmInputRef.current?.blur();
      }
    },
    [dispatch]
  );

  const handleBpmBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const val = Number(e.target.value);
      if (isNaN(val) || val < MIN_BPM || val > MAX_BPM) {
        dispatch(setBpm(bpm));
      }
    },
    [dispatch, bpm]
  );

  // ═══════════════════════════════════════════════════════════
  // HANDLERS — PROYECTO
  // ═══════════════════════════════════════════════════════════

  const handleRename = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(renameProject(e.target.value));
    },
    [dispatch]
  );

  const handleRenameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        (e.target as HTMLInputElement).blur();
      }
    },
    []
  );

  // ═══════════════════════════════════════════════════════════
  // HANDLERS — MASTER
  // ═══════════════════════════════════════════════════════════

  const handleToggleMasterMute = useCallback(() => {
    dispatch(toggleMasterMute());
  }, [dispatch]);

  const handleMasterVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      dispatch(setMasterVolume(Number(e.target.value)));
    },
    [dispatch]
  );

  // ═══════════════════════════════════════════════════════════
  // HANDLERS — UI
  // ═══════════════════════════════════════════════════════════

  const handleToggleShortcuts = useCallback(() => {
    dispatch(toggleShortcutsOverlay());
  }, [dispatch]);

  /**
   * Botón ☰ del TopBar → abre/cierra Preferences (singleton).
   * Semántica según lo acordado: A) directo a Preferences (sin dropdown).
   */
  const handleOpenMainMenu = useCallback(() => {
    dispatch(togglePreferences());
  }, [dispatch]);

  // ═══════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════

  return (
    <header className="topbar-bl" role="banner">

      {/* ── FILA SUPERIOR: menú + logo + título + acciones ── */}
      <div className="tb-row-top">
        <div className="tb-left">
          <button
            className="tb-menu-btn"
            title="Preferences"
            aria-label="Abrir preferencias"
            aria-haspopup="dialog"
            aria-expanded={preferencesOpen}
            onClick={handleOpenMainMenu}
          >
            <MenuIcon size={20} />
          </button>

          <div className="tb-logo" aria-label="Web DAW">
            <LogoIcon
              className="tb-logo-icon"
              showInnerText={false}
            />
            <span className="tb-logo-text">WEB DAW</span>
          </div>
        </div>

        <div className="tb-title-wrap">
          <input
            className={`tb-title${isDirty ? ' is-dirty' : ''}`}
            value={projectName}
            onChange={handleRename}
            onKeyDown={handleRenameKeyDown}
            aria-label="Nombre del proyecto"
            title={isDirty ? 'Cambios sin guardar' : projectName}
            spellCheck={false}
          />
          {isDirty && (
            <span
              className="tb-dirty-dot"
              aria-label="Cambios sin guardar"
              title="Cambios sin guardar"
            />
          )}
        </div>

        <div className="tb-top-right">
          <div className="tb-saved-info" aria-live="polite">
            <div className="tb-saved-lbl">Último guardado</div>
            <div className="tb-saved-val">
              {formatLastSaved(modifiedAt)}
            </div>
          </div>

          <button
            className="tb-btn-save"
            title="Guardar (Ctrl+S)"
            aria-label="Guardar proyecto"
          >
            <Icon name="save" size={13} />
            <span>Guardar</span>
          </button>

          <button
            className="tb-btn-publish"
            title="Publicar"
            aria-label="Publicar proyecto"
          >
            <span aria-hidden="true">🌐</span>
            <span>Publicar</span>
          </button>

          <button
            className="tb-btn-help"
            title="Atajos de teclado (F1)"
            aria-label="Ver atajos de teclado"
            onClick={handleToggleShortcuts}
          >
            ?
          </button>
        </div>
      </div>

      {/* ── FILA INFERIOR: tools · BPM · transport · master ── */}
      <div className="tb-row-bottom">

        {/* ─── Tools ─────────────────────────────────────── */}
        <div className="tb-tools" role="toolbar" aria-label="Herramientas">
          <button
            className="tb-icon-btn"
            title="Deshacer (Ctrl+Z)"
            aria-label="Deshacer"
            disabled
          >
            <Icon name="undo" size={14} />
          </button>

          <button
            className="tb-icon-btn"
            title="Rehacer (Ctrl+Shift+Z)"
            aria-label="Rehacer"
            disabled
          >
            <Icon name="redo" size={14} />
          </button>

          <div className="tb-sep" aria-hidden="true" />

          <button
            className={`tb-icon-btn${metronomeOn ? ' active' : ''}`}
            onClick={handleToggleMetronome}
            title="Metrónomo (Ctrl+Shift+M)"
            aria-label={metronomeOn ? 'Desactivar metrónomo' : 'Activar metrónomo'}
            aria-pressed={metronomeOn}
          >
            <Icon name="metronome" size={16} />
          </button>

          <div className="tb-sep" aria-hidden="true" />

          <div className="tb-bpm-box" title="BPM (↑↓ para ajustar)">
            <input
              ref={bpmInputRef}
              type="number"
              className="tb-bpm mono"
              value={bpm}
              min={MIN_BPM}
              max={MAX_BPM}
              step={BPM_NUDGE_STEP}
              onChange={handleBpmChange}
              onKeyDown={handleBpmKeyDown}
              onBlur={handleBpmBlur}
              aria-label="Tempo en BPM"
            />
            <span className="tb-bpm-lbl" aria-hidden="true">bpm</span>
          </div>

          <div
            className="tb-sig-box mono"
            aria-label={`Compás ${timeSignature.numerator} por ${timeSignature.denominator}`}
            title="Compás"
          >
            {timeSignature.numerator} / {timeSignature.denominator}
          </div>
        </div>

        {/* ─── Transport ──────────────────────────────────── */}
        <div className="tb-transport" role="toolbar" aria-label="Transporte">
          <button
            className="tb-icon-btn"
            onClick={handleGoToStart}
            onDoubleClick={handleStopFull}
            title="Ir al inicio (Home) · Doble clic: Stop total"
            aria-label="Ir al inicio"
          >
            <Icon name="skip-back" size={14} />
          </button>

          <button
            className={`tb-play-btn${isPlaying ? ' playing' : ''}`}
            onClick={handlePlayPause}
            title={isPlaying ? 'Pausa (Space)' : 'Reproducir (Space)'}
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            aria-pressed={isPlaying}
          >
            <Icon name={isPlaying ? 'pause' : 'play'} size={18} />
          </button>

          <button
            className="tb-icon-btn"
            onClick={handleStopFull}
            title="Stop (Enter)"
            aria-label="Detener y volver al inicio"
          >
            <Icon name="stop" size={14} />
          </button>

          {/* 🎙️ Selector de dispositivo de entrada */}
          <InputDeviceSelector />

          <button
            className={`tb-icon-btn tb-rec${isRecording ? ' active' : ''}`}
            onClick={handleToggleRecord}
            title="Grabar (R)"
            aria-label={isRecording ? 'Detener grabación' : 'Grabar'}
            aria-pressed={isRecording}
          >
            <Icon name="record" size={14} />
          </button>

          <button
            className={`tb-icon-btn${loopEnabled ? ' active' : ''}`}
            onClick={handleToggleLoop}
            title="Loop (L)"
            aria-label={loopEnabled ? 'Desactivar loop' : 'Activar loop'}
            aria-pressed={loopEnabled}
          >
            <Icon name="loop" size={14} />
          </button>

          <div
            className="tb-time mono"
            aria-label={`Posición: ${formatTime(displayTime)}`}
            aria-live="off"
          >
            {formatTime(displayTime)}
          </div>
        </div>

        {/* ─── Master ─────────────────────────────────────── */}
        <div className="tb-right" role="group" aria-label="Volumen master">
          <button
            className={`tb-icon-btn${masterMuted ? ' active-mute' : ''}`}
            onClick={handleToggleMasterMute}
            title={masterMuted ? 'Quitar mute master' : 'Silenciar master'}
            aria-label={masterMuted ? 'Quitar mute master' : 'Silenciar master'}
            aria-pressed={masterMuted}
          >
            <Icon name={masterMuted ? 'volume-mute' : 'volume'} size={16} />
          </button>

          <input
            type="range"
            className="tb-vol"
            min={MIN_VOLUME}
            max={MAX_VOLUME}
            step={VOLUME_STEP}
            value={masterVolume}
            onChange={handleMasterVolumeChange}
            aria-label="Volumen master"
            aria-valuetext={formatDb(masterVolume)}
          />

          <div
            className="tb-db mono"
            aria-hidden="true"
            title="Nivel master en dB"
          >
            {formatDb(masterVolume)}
          </div>
        </div>
      </div>
    </header>
  );
}