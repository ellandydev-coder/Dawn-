// src/features/mixer/components/FaderControl.tsx

import {
  memo,
  useCallback,
  useMemo,
  useState,
  type CSSProperties,
} from 'react';
import { useFaderDrag } from '../hooks/useFaderDrag';
import { formatDb, linearToDb } from '@shared/utils/dBConversion';
import { FaderTooltip } from './FaderTooltip';
import './FaderControl.css';

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════

const SILENCE_THRESHOLD = 0.001;
const UNITY_GAIN = 1.0;

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════

function buildValueText(value: number): string {
  if (value <= SILENCE_THRESHOLD) return '-∞ dB';
  return `${formatDb(linearToDb(value))} dB`;
}

// ═══════════════════════════════════════════
// Tipos
// ═══════════════════════════════════════════

export interface FaderControlProps {
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  onDoubleClick?: () => void;
  height?: number;
  disabled?: boolean;
  label?: string;
  showTooltip?: boolean;
}

/**
 * FaderControl
 * ------------
 * Fader vertical profesional inspirado en consolas físicas.
 *
 * Tooltip estilo REAPER:
 *   ✔ Anclado al fader (no al cursor)
 *   ✔ Sigue verticalmente al thumb (se mueve con el valor)
 *   ✔ Aparece a la derecha del fader
 *   ✔ Delay 300ms en hover, instantáneo durante drag
 */
function FaderControlBase({
  value,
  onChange,
  onCommit,
  onDoubleClick,
  height = 140,
  disabled = false,
  label,
  showTooltip = true,
}: FaderControlProps) {
  const {
    targetRef,
    isDragging,
    handlers,
    faderPct,
  } = useFaderDrag({
    value,
    onChange,
    onCommit,
    disabled,
  });

  // ─── Hover state ──────────────────────────────────────
  const [isHovering, setIsHovering] = useState(false);

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    setIsHovering(true);
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
  }, []);

  // ─── Derivados memoizados ─────────────────────────────

  const containerStyle = useMemo<CSSProperties>(
    () => ({ height }),
    [height]
  );

  const laneClassName = useMemo(
    () =>
      [
        'fader-lane',
        isDragging && 'is-dragging',
        disabled && 'is-disabled',
      ]
        .filter(Boolean)
        .join(' '),
    [isDragging, disabled]
  );

  const thumbStyle = useMemo<CSSProperties>(
    () => ({ top: `${faderPct}%` }),
    [faderPct]
  );

  const ariaValueText = useMemo(() => buildValueText(value), [value]);
  const ariaValueNow  = useMemo(() => Math.round(faderPct), [faderPct]);

  const isAtUnity = value === UNITY_GAIN;

  const faderLane = (
    <div
      ref={targetRef}
      className={laneClassName}
      {...handlers}
      onDoubleClick={disabled ? undefined : onDoubleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      tabIndex={disabled ? -1 : 0}
      role="slider"
      aria-label={label ?? 'Fader'}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={ariaValueNow}
      aria-valuetext={ariaValueText}
      aria-orientation="vertical"
      aria-disabled={disabled || undefined}
    >
      <div className="fader-track-visual">
        <div
          className={`fader-thumb${isAtUnity ? ' at-unity' : ''}`}
          style={thumbStyle}
          aria-hidden="true"
        />
      </div>
    </div>
  );

  return (
    <div className="fader-container" style={containerStyle}>
      {showTooltip && !disabled ? (
        <FaderTooltip
          value={value}
          isDragging={isDragging}
          isHovering={isHovering}
          faderPct={faderPct}
        >
          {faderLane}
        </FaderTooltip>
      ) : (
        faderLane
      )}
    </div>
  );
}

export const FaderControl = memo(FaderControlBase);