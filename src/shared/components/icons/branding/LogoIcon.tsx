// src/shared/components/icons/branding/LogoIcon.tsx

import type { CSSProperties } from 'react';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface LogoIconProps {
  /** Tamaño en píxeles (aplica a width y height por igual) */
  size?: number;
  /** Clase CSS opcional para override desde CSS externo */
  className?: string;
  /** Estilo inline opcional */
  style?: CSSProperties;
  /** Título accesible; si no se pasa, el SVG es decorativo */
  title?: string;
  /**
   * Si es `false`, oculta el texto "DAW MOBILE" del interior.
   * Útil para tamaños pequeños (< 48px) donde el texto no
   * sería legible. Por defecto se muestra.
   * @default true
   */
  showInnerText?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 CONSTANTES DE DISEÑO
// ═══════════════════════════════════════════════════════════════

const VIEWBOX_SIZE = 100;

const GRADIENT_ID_RING = 'logo-grad-ring';
const GRADIENT_ID_BARS = 'logo-grad-bars';
const GRADIENT_ID_MOBILE = 'logo-grad-mobile';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * Logo oficial de Web DAW.
 *
 * Diseño:
 *   • Anillo circular con gradiente violeta → cyan
 *   • 6 barras verticales de ecualizador (alturas escalonadas)
 *   • Texto "DAW" en blanco + "MOBILE" con gradiente
 *
 * Uso típico:
 *   <LogoIcon size={40} showInnerText={false} />   ← topbar
 *   <LogoIcon size={128} />                        ← splash
 *
 * Al ser SVG, escala perfectamente a cualquier tamaño sin
 * pérdida de calidad y sin generar CLS.
 */
export function LogoIcon({
  size = 40,
  className,
  style,
  title,
  showInnerText = true,
}: LogoIconProps) {
  const isDecorative = !title;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`}
      width={size}
      height={size}
      className={className}
      style={style}
      role={isDecorative ? 'presentation' : 'img'}
      aria-hidden={isDecorative || undefined}
      aria-label={isDecorative ? undefined : title}
      focusable="false"
    >
      {title && <title>{title}</title>}

      {/* ═══════════════════════════════════════════════
          DEFINICIONES: gradientes reutilizables
          ═══════════════════════════════════════════════ */}
      <defs>
        {/* Gradiente del anillo (diagonal top-left → bottom-right) */}
        <linearGradient
          id={GRADIENT_ID_RING}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="100%"
        >
          <stop offset="0%"   stopColor="#a855f7" />
          <stop offset="50%"  stopColor="#6366f1" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>

        {/* Gradiente de las barras (horizontal left → right) */}
        <linearGradient
          id={GRADIENT_ID_BARS}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%"   stopColor="#a855f7" />
          <stop offset="50%"  stopColor="#6366f1" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>

        {/* Gradiente del texto "MOBILE" (más saturado) */}
        <linearGradient
          id={GRADIENT_ID_MOBILE}
          x1="0%"
          y1="0%"
          x2="100%"
          y2="0%"
        >
          <stop offset="0%"   stopColor="#a855f7" />
          <stop offset="50%"  stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>

      {/* ═══════════════════════════════════════════════
          ANILLO EXTERIOR
          ═══════════════════════════════════════════════ */}
      <circle
        cx="50"
        cy="50"
        r="46"
        fill="none"
        stroke={`url(#${GRADIENT_ID_RING})`}
        strokeWidth="1.5"
      />

      {/* ═══════════════════════════════════════════════
          BARRAS DE ECUALIZADOR (6 barras escalonadas)
          -------------------------------------------------
          Cuando showInnerText=true, las barras se elevan
          para dejar sitio al texto "DAW MOBILE" abajo.
          ═══════════════════════════════════════════════ */}
      <g fill={`url(#${GRADIENT_ID_BARS})`}>
        {showInnerText ? (
          // Layout con texto: barras más altas y arriba
          <>
            <rect x="31.5" y="34" width="4.5" height="20" rx="2.25" />
            <rect x="38"   y="28" width="4.5" height="26" rx="2.25" />
            <rect x="44.5" y="22" width="4.5" height="32" rx="2.25" />
            <rect x="51"   y="16" width="4.5" height="38" rx="2.25" />
            <rect x="57.5" y="22" width="4.5" height="32" rx="2.25" />
            <rect x="64"   y="28" width="4.5" height="26" rx="2.25" />
          </>
        ) : (
          // Layout sin texto: barras centradas verticalmente
          <>
            <rect x="31.5" y="48" width="4.5" height="18" rx="2.25" />
            <rect x="38"   y="40" width="4.5" height="26" rx="2.25" />
            <rect x="44.5" y="34" width="4.5" height="32" rx="2.25" />
            <rect x="51"   y="26" width="4.5" height="40" rx="2.25" />
            <rect x="57.5" y="34" width="4.5" height="32" rx="2.25" />
            <rect x="64"   y="40" width="4.5" height="26" rx="2.25" />
          </>
        )}
      </g>

      {/* ═══════════════════════════════════════════════
          TEXTO INTERIOR "DAW MOBILE"
          -------------------------------------------------
          Diseño fiel al logo original:
            • "DAW"    → blanco/gris claro, tipografía fina,
                        con el punto de "A" en cyan (acento)
            • "MOBILE" → gradiente violeta-cyan, más pequeño,
                        con letter-spacing amplio
          ═══════════════════════════════════════════════ */}
      {showInnerText && (
        <g>
          {/* "DAW" — blanco/gris claro */}
          <text
            x="50"
            y="73"
            textAnchor="middle"
            fill="#e5e7eb"
            fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
            fontSize="14"
            fontWeight="300"
            letterSpacing="2"
          >
            DAW
          </text>

          {/*
            Punto decorativo debajo del texto (recreación del
            detalle visual del logo original entre las letras).
          */}
          <circle cx="50" cy="76" r="0.9" fill="#22d3ee" />

          {/* "MOBILE" — gradiente violeta → cyan */}
          <text
            x="50"
            y="86"
            textAnchor="middle"
            fill={`url(#${GRADIENT_ID_MOBILE})`}
            fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif"
            fontSize="7"
            fontWeight="400"
            letterSpacing="2.5"
          >
            MOBILE
          </text>
        </g>
      )}
    </svg>
  );
}