// src/features/mixer/components/MasterChannel.tsx

import { memo, useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  setMasterVolume,
  toggleMasterMute,
} from '@state/slices/mixer/mixerSlice';
import { FaderControl } from './FaderControl';
import { useMeter } from '@audio/hooks/useMeter';
import {
  formatDb,
  linearToDb,
  DEFAULT_VOLUME,
} from '@shared/utils/dBConversion';
import './MasterChannel.css';

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════

const NUM_SEGMENTS = 30;
const DB_MIN = -54;
const DB_MAX = 12;
const DB_RANGE = DB_MAX - DB_MIN;
const YELLOW_THRESHOLD_DB = -12;
const RED_THRESHOLD_DB = -3;

const DB_SCALE = [
  '12', '6', '0', '-6', '-12',
  '-18', '-24', '-30', '-36', '-42',
] as const;

// ═══════════════════════════════════════════
// Helpers puros (fuera del componente)
// ═══════════════════════════════════════════

function linearToPct(v: number): number {
  if (v <= 0) return 0;
  const db = linearToDb(v);
  const clamped = Math.max(DB_MIN, Math.min(DB_MAX, db));
  return ((clamped - DB_MIN) / DB_RANGE) * 100;
}

// Precalculados a nivel módulo — no se recalculan nunca
const YELLOW_PCT = linearToPct(Math.pow(10, YELLOW_THRESHOLD_DB / 20));
const RED_PCT = linearToPct(Math.pow(10, RED_THRESHOLD_DB / 20));

function getSegmentClassName(segPct: number, rmsPct: number): string {
  if (segPct > rmsPct) return 'master-meter-seg';
  if (segPct > RED_PCT) return 'master-meter-seg active-red';
  if (segPct > YELLOW_PCT) return 'master-meter-seg active-yellow';
  return 'master-meter-seg active-green';
}

// ═══════════════════════════════════════════
// Subcomponente: MeterColumn
// ═══════════════════════════════════════════

interface MeterColumnProps {
  rmsPct: number;
  label: string;
}

/**
 * MeterColumn — columna de segmentos del medidor.
 * Separado y memoizado para que solo re-renderice
 * cuando cambia el nivel de RMS.
 */
const MeterColumn = memo(function MeterColumn({
  rmsPct,
  label,
}: MeterColumnProps) {
  return (
    <div className="master-meter" aria-label={label}>
      {Array.from({ length: NUM_SEGMENTS }, (_, i) => {
        const segPct = ((i + 0.5) / NUM_SEGMENTS) * 100;
        return (
          <div
            key={i}
            className={getSegmentClassName(segPct, rmsPct)}
          />
        );
      })}
    </div>
  );
});

// ═══════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════

export interface MasterChannelProps {
  /** Callback al hacer commit del volumen (undo/redo) */
  onVolumeCommit?: (value: number) => void;
}

/**
 * MasterChannel
 * -------------
 * Canal MASTER del mixer — bus principal de salida.
 * Diseño auténtico REAPER v6/v7 con medidores + escala + fader integrados.
 *
 * ✔ Memoizado
 * ✔ Handlers estables
 * ✔ Accesible (ARIA)
 * ✔ MeterColumn extraído y memoizado
 * ✔ Helpers puros fuera del componente
 * ✔ Compatible con undo/redo
 */
function MasterChannelBase({ onVolumeCommit }: MasterChannelProps) {
  const dispatch = useAppDispatch();

  // ─── Selectores atómicos ────────────────
  const masterVolume = useAppSelector((s) => s.mixer.global.masterVolume);
  const masterMuted  = useAppSelector((s) => s.mixer.global.masterMuted);
  const meter        = useMeter('master');

  // ─── Handlers estables ──────────────────
  const handleVolumeChange = useCallback(
    (v: number) => dispatch(setMasterVolume(v)),
    [dispatch]
  );

  const handleVolumeReset = useCallback(
    () => dispatch(setMasterVolume(DEFAULT_VOLUME)),
    [dispatch]
  );

  const handleVolumeResetKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        dispatch(setMasterVolume(DEFAULT_VOLUME));
      }
    },
    [dispatch]
  );

  const handleToggleMute = useCallback(
    () => dispatch(toggleMasterMute()),
    [dispatch]
  );

  // ─── Derivados memoizados ───────────────
  const rmsPct = useMemo(
    () => linearToPct(meter.rms),
    [meter.rms]
  );

  const dbLabel = useMemo(
    () => formatDb(masterVolume),
    [masterVolume]
  );

  const volumeText = useMemo(
    () => (masterVolume <= 0.001 ? '-inf' : `${dbLabel}dB`),
    [masterVolume, dbLabel]
  );

  const rmsText = useMemo(
    () => (meter.rms > 0 ? formatDb(meter.rms) : '-inf'),
    [meter.rms]
  );

  const stripClassName = useMemo(
    () => `master-strip${masterMuted ? ' is-muted' : ''}`,
    [masterMuted]
  );

  // ─── Render ─────────────────────────────
  return (
    <div
      className={stripClassName}
      role="group"
      aria-label="Canal Master"
    >
      {/* Header */}
      <div className="master-header">
        <span className="master-center-label">center</span>
        <div
          className="master-center-knob"
          title="Pan Center (no aplicable en master)"
          aria-label="Pan center"
          aria-hidden="true"
        />
      </div>

      {/* dB Display */}
      <div
        className="master-db-top mono"
        onDoubleClick={handleVolumeReset}
        onKeyDown={handleVolumeResetKeyDown}
        title="Doble clic = reset volumen"
        aria-label={`Volumen master: ${dbLabel} decibelios. Doble clic para reset`}
        role="button"
        tabIndex={0}
      >
        {volumeText}
      </div>

      {/* Labels -inf */}
      <div className="master-inf-labels" aria-hidden="true">
        <span>-inf</span>
        <span>-inf</span>
      </div>

      {/* Zona principal */}
      <div className="master-main">

        {/* Medidores + escala */}
        <div className="master-meters-area">
          <MeterColumn rmsPct={rmsPct} label="Medidor izquierdo" />

          <div className="master-db-scale" aria-hidden="true">
            {DB_SCALE.map((label) => (
              <span key={label}>{label}</span>
            ))}
          </div>

          <MeterColumn rmsPct={rmsPct} label="Medidor derecho" />
        </div>

        {/* Fader */}
        <div className="master-fader-container">
          <FaderControl
            value={masterVolume}
            onChange={handleVolumeChange}
            onCommit={onVolumeCommit}
            onDoubleClick={handleVolumeReset}
            label="Volumen master"
          />
        </div>

        {/* Botones laterales */}
        <div className="master-buttons-col">
          <button
            type="button"
            className="master-btn btn-mono"
            title="Salida mono"
            aria-label="Salida mono"
          >
            <svg viewBox="0 0 16 10" width="14" height="9" aria-hidden="true">
              <circle cx="6"  cy="5" r="4" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.7" />
              <circle cx="10" cy="5" r="4" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.7" />
            </svg>
          </button>

          <button
            type="button"
            className={`master-btn btn-m${masterMuted ? ' active' : ''}`}
            onClick={handleToggleMute}
            aria-pressed={masterMuted}
            aria-label={masterMuted ? 'Quitar mute master' : 'Silenciar master'}
            title={masterMuted ? 'Quitar mute' : 'Silenciar master'}
          >
            M
          </button>

          <button
            type="button"
            className="master-btn btn-s"
            disabled
            aria-disabled="true"
            aria-label="Solo no disponible en master"
            title="Solo no aplicable al master"
          >
            S
          </button>

          <button
            type="button"
            className="master-btn btn-route"
            title="Routing"
            aria-label="Routing"
          >
            <svg viewBox="0 0 16 10" aria-hidden="true">
              <path d="M3 2 L7 8" stroke="#00f3ff" strokeWidth="2" strokeLinecap="round" />
              <path d="M8 2 L12 8" stroke="#ffe600" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <button
            type="button"
            className="master-btn btn-fx"
            title="Cadena de efectos"
            aria-label="Abrir cadena de efectos"
          >
            FX
          </button>

          <button
            type="button"
            className="master-btn btn-power"
            title="Bypass FX"
            aria-label="Bypass de efectos"
          >
            <svg viewBox="0 0 10 10" width="8" height="8" aria-hidden="true">
              <path
                d="M5 1 V5 M2.5 3 A 3 3 0 1 0 7.5 3"
                stroke="currentColor"
                strokeWidth="1.2"
                fill="none"
              />
            </svg>
          </button>

          <button
            type="button"
            className="master-btn btn-trim"
            title="Automation Trim"
            aria-label="Automation trim"
          >
            <svg viewBox="0 0 14 8" width="12" height="7" aria-hidden="true">
              <circle cx="2"  cy="6" r="1" fill="currentColor" />
              <circle cx="7"  cy="2" r="1" fill="currentColor" />
              <circle cx="12" cy="5" r="1" fill="currentColor" />
              <path d="M2 6 L7 2 L12 5" stroke="currentColor" strokeWidth="1" fill="none" />
            </svg>
          </button>

          <button
            type="button"
            className="master-btn btn-info"
            title="Información"
            aria-label="Información del canal master"
          >
            i
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="master-footer">
        <div
          className="master-rms"
          aria-label={`Nivel RMS: ${rmsText}`}
        >
          <span className="master-rms-label">RMS</span>
          <span className="master-rms-value mono">{rmsText}</span>
        </div>
        <div className="master-footer-name">MASTER</div>
      </div>
    </div>
  );
}

export const MasterChannel = memo(MasterChannelBase);