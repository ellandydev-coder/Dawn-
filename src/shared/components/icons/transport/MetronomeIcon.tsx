import { IconBase } from '../IconBase';
import type { IconProps } from '../types';

/**
 * MetronomeIcon
 * -------------
 * Diseño clásico de metrónomo de estudio:
 *   - Cuerpo trapezoidal (más ancho abajo)
 *   - Base sólida
 *   - Péndulo diagonal con peso al final
 *   - Línea superior que indica la abertura
 */
export function MetronomeIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Metronome'}>
      {/* Cuerpo trapezoidal del metrónomo */}
      <path d="M7 3 L17 3 L20 21 L4 21 Z" />
      {/* Línea superior (la "boca" donde sale el péndulo) */}
      <line x1="9" y1="6" x2="15" y2="6" />
      {/* Péndulo diagonal */}
      <line x1="12" y1="6" x2="8.5" y2="18" />
      {/* Peso del péndulo (círculo) */}
      <circle cx="8.5" cy="18" r="1.5" fill="currentColor" />
      {/* Base inferior reforzada */}
      <line x1="4" y1="21" x2="20" y2="21" strokeWidth="2.5" />
    </IconBase>
  );
}