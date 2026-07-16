// src/shared/components/icons/ui/PushpinIcon.tsx

import type { CSSProperties } from 'react';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface PushpinIconProps {
  /** Tamaño en píxeles (aplica a width y height por igual) */
  size?: number;
  /** Clase CSS opcional */
  className?: string;
  /** Estilo inline opcional */
  style?: CSSProperties;
  /** Título accesible; si no se pasa, el SVG es decorativo */
  title?: string;
  /**
   * Color principal del pin (default: rojo clásico #dc2626).
   * Puedes pasar 'currentColor' para heredar del padre CSS.
   */
  color?: string;
  /**
   * Color del pincho metálico (default: gris plateado).
   */
  needleColor?: string;
  /**
   * Si `true`, el pin se dibuja "clavado":
   *   • La aguja desaparece
   *   • El cuerpo baja unos píxeles
   * Si `false` (default), el pin se dibuja "levantado" con la aguja visible.
   *
   * La transición entre estados es suave (200ms).
   */
  pinned?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 🎨 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const VIEWBOX = 100;

/** Píxeles que baja el pin cuando está "clavado" */
const PINNED_OFFSET_Y = 6;

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * PushpinIcon
 * -----------
 * Icono de chincheta/pinchito (thumbtack / pushpin) con dos estados:
 *
 *   • pinned=false → aguja visible, pin en posición alta ("levantado")
 *   • pinned=true  → aguja oculta, pin bajado ("clavado")
 *
 * El color NUNCA cambia con el estado — siempre es `color`.
 * La única diferencia visual entre estados es la aguja y la altura.
 *
 * Uso típico:
 *   <PushpinIcon size={16} pinned={isAnchored} />
 *   <PushpinIcon size={24} color="#eab308" pinned />
 */
export function PushpinIcon({
  size = 24,
  className,
  style,
  title,
  color = '#dc2626',
  needleColor = '#a8a8b0',
  pinned = false,
}: PushpinIconProps) {
  const isDecorative = !title;
  const bodyOffset = pinned ? PINNED_OFFSET_Y : 0;

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
    >
      {title && <title>{title}</title>}

      {/* ── Gradientes ──────────────────────────────────────── */}
      <defs>
        <radialGradient id="pin-head" cx="35%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#ff6b6b" />
          <stop offset="60%"  stopColor={color} />
          <stop offset="100%" stopColor="#991b1b" />
        </radialGradient>

        <radialGradient id="pin-base" cx="50%" cy="30%" r="60%">
          <stop offset="0%"   stopColor={color} />
          <stop offset="100%" stopColor="#7a1414" />
        </radialGradient>

        <linearGradient id="pin-needle" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#6a6a72" />
          <stop offset="50%"  stopColor={needleColor} />
          <stop offset="100%" stopColor="#4a4a52" />
        </linearGradient>
      </defs>

      {/* ══════════════════════════════════════════════════════
          AGUJA
          -------------------------------------------------------
          Se anima el opacity para desaparecer/aparecer suavemente.
          Cuando pinned=true, opacity=0.
          ══════════════════════════════════════════════════════ */}
      <g
        style={{
          opacity: pinned ? 0 : 1,
          transition: 'opacity 200ms ease-out',
        }}
      >
        <path
          d="M46 68 L54 68 L52 92 L48 92 Z"
          fill="url(#pin-needle)"
          stroke="#3a3a42"
          strokeWidth="0.6"
        />
      </g>

      {/* ══════════════════════════════════════════════════════
          CUERPO DEL PIN (cabeza + base + cilindro)
          -------------------------------------------------------
          Se agrupa todo y se aplica un translateY cuando está
          "clavado" — el pin baja PINNED_OFFSET_Y píxeles.
          Transición suave 200ms.
          ══════════════════════════════════════════════════════ */}
      <g
        style={{
          transform: `translateY(${bodyOffset}px)`,
          transition: 'transform 200ms ease-out',
        }}
      >
        {/* ── BASE CIRCULAR (disco ancho aplastado) ────────── */}
        <ellipse cx="50" cy="72" rx="30" ry="6" fill="#7a1414" />
        <ellipse cx="50" cy="68" rx="30" ry="6" fill="url(#pin-base)" />
        <ellipse
          cx="50"
          cy="66"
          rx="24"
          ry="2"
          fill="rgba(255,255,255,0.2)"
        />

        {/* ── CUERPO CILÍNDRICO ────────────────────────────── */}
        <rect x="38" y="30" width="24" height="38" fill={color} />
        <rect x="38" y="30" width="4"  height="38" fill="rgba(0,0,0,0.18)" />
        <rect x="56" y="30" width="4"  height="38" fill="rgba(255,255,255,0.12)" />

        {/* ── CABEZA ───────────────────────────────────────── */}
        <ellipse cx="50" cy="34" rx="22" ry="5" fill="#7a1414" />
        <ellipse cx="50" cy="28" rx="22" ry="8" fill="url(#pin-head)" />
        <ellipse
          cx="46"
          cy="24"
          rx="12"
          ry="3"
          fill="rgba(255,255,255,0.5)"
        />
        <ellipse
          cx="44"
          cy="23"
          rx="4"
          ry="1.2"
          fill="rgba(255,255,255,0.85)"
        />
      </g>
    </svg>
  );
}