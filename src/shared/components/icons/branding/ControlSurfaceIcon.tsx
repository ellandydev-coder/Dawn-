// src/shared/components/icons/branding/ControlSurfaceIcon.tsx

import type { CSSProperties } from 'react';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface ControlSurfaceIconProps {
  /** Tamaño en píxeles (aplica a width y height por igual) */
  size?: number;
  /** Clase CSS opcional */
  className?: string;
  /** Estilo inline opcional */
  style?: CSSProperties;
  /** Título accesible; si no se pasa, el SVG es decorativo */
  title?: string;
  /**
   * Color de los trazos. Por defecto blanco.
   * Puedes pasar 'currentColor' para heredar del padre CSS.
   */
  stroke?: string;
  /** Grosor de línea (default: 2) */
  strokeWidth?: number;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const VIEWBOX = 100;

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * ControlSurfaceIcon
 * ------------------
 * Logo de DAWN — studio monitor en estilo line-art / outline.
 *
 * Diseño:
 *   • 100% trazos, sin relleno (transparente)
 *   • Solo bordes blancos (o color pasado en `stroke`)
 *   • Estilo minimalista 2D
 *
 * Uso:
 *   <ControlSurfaceIcon size={96} title="Web DAW" />              ← splash
 *   <ControlSurfaceIcon size={24} stroke="currentColor" />        ← toolbar
 *   <ControlSurfaceIcon size={40} stroke="#a5b4fc" />             ← acento
 */
export function ControlSurfaceIcon({
  size = 64,
  className,
  style,
  title,
  stroke = '#ffffff',
  strokeWidth = 2,
}: ControlSurfaceIconProps) {
  const isDecorative = !title;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEWBOX} ${VIEWBOX}`}
      width={size}
      height={size}
      className={className}
      style={style}
      role={isDecorative ? 'presentation' : 'img'}
      aria-hidden={isDecorative || undefined}
      aria-label={isDecorative ? undefined : title}
      focusable="false"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {title && <title>{title}</title>}

      {/* ── Gabinete ────────────────────────────────────────── */}
      <rect
        x="22"
        y="6"
        width="56"
        height="86"
        rx="6"
        ry="6"
      />

      {/* ── Tweeter (pequeño, arriba) ───────────────────────── */}
      <circle cx="50" cy="26" r="10" />
      {/* Domo central del tweeter */}
      <circle cx="50" cy="26" r="3" />

      {/* ── Woofer (grande, abajo) ──────────────────────────── */}
      <circle cx="50" cy="62" r="20" />
      {/* Anillo intermedio del woofer */}
      <circle cx="50" cy="62" r="14" />
      {/* Dust cap (tapa central) */}
      <circle cx="50" cy="62" r="6" />

      {/* ── LED indicador (esquina inferior izquierda) ──────── */}
      <circle cx="30" cy="83" r="1.6" />
    </svg>
  );
}