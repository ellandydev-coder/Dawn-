// src/features/mixer/components/FaderTooltip.tsx

import { memo, useMemo, type ReactElement } from 'react';
import { Tooltip } from '@shared/components/Tooltip';
import {
  formatDb,
  SILENCE_SYMBOL,
} from '@shared/utils/dBConversion';
import './FaderTooltip.css';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface FaderTooltipProps {
  /** Valor lineal actual del fader (0..1+) */
  value: number;
  /** ¿Está el fader siendo arrastrado ahora? */
  isDragging: boolean;
  /** ¿Está el mouse sobre el fader (hover)? */
  isHovering: boolean;
  /** Elemento anclado (el lane del fader) */
  children: ReactElement;
  /**
   * Posición vertical del thumb en % (0-100).
   * Se usa para desplazar el tooltip verticalmente y que "siga" al thumb.
   */
  faderPct: number;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const HOVER_DELAY_MS  = 300;   // estilo REAPER
const DRAG_DELAY_MS   = 0;     // instantáneo durante drag
const TOOLTIP_OFFSET  = 12;    // separación horizontal del fader
const LINEAR_DECIMALS = 2;
const SILENCE_THRESHOLD = 0.001;

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

function formatTooltipContent(value: number): { db: string; linear: string } {
  if (value <= SILENCE_THRESHOLD) {
    return {
      db:     `${SILENCE_SYMBOL} dB`,
      linear: '0.00',
    };
  }

  return {
    db:     `${formatDb(value)} dB`,
    linear: value.toFixed(LINEAR_DECIMALS),
  };
}

// ═══════════════════════════════════════════════════════════════
// 🎯 COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * FaderTooltip
 * ------------
 * Tooltip especializado para faders del mixer, estilo REAPER.
 *
 * Comportamiento:
 *   - Anclado al fader (no al cursor)
 *   - Se posiciona a la derecha del fader
 *   - Verticalmente sigue al thumb (usa faderPct como referencia)
 *   - Hover 300ms → aparece
 *   - Durante drag → instantáneo y en tiempo real
 *   - Contenido: dB (grande) + linear (pequeño)
 */
function FaderTooltipBase({
  value,
  isDragging,
  isHovering,
  children,
  faderPct,
}: FaderTooltipProps) {
  const { db, linear } = useMemo(
    () => formatTooltipContent(value),
    [value]
  );

  const content = useMemo(
    () => (
      <div className="fader-tooltip-content">
        <div className="fader-tooltip-db mono">{db}</div>
        <div className="fader-tooltip-linear mono">{linear}</div>
      </div>
    ),
    [db, linear]
  );

  const isOpen    = isDragging || isHovering;
  const showDelay = isDragging ? DRAG_DELAY_MS : HOVER_DELAY_MS;

  return (
    <Tooltip
      content={content}
      placement="right"
      offset={TOOLTIP_OFFSET}
      showDelay={showDelay}
      hideDelay={0}
      open={isOpen}
      className="fader-tooltip"
      role="status"
      anchorPct={faderPct}
    >
      {children}
    </Tooltip>
  );
}

export const FaderTooltip = memo(FaderTooltipBase);