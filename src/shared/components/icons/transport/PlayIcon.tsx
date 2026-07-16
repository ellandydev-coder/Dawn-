import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function PlayIcon(props: IconProps) {
  return (
    <IconBase
      {...props}
      filled
      strokeLinejoin="round"
      title={props.title ?? 'Play'}
    >
      <path d="M7 4.5 L19 12 L7 19.5 Z" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

/*
 * Este export lo detecta el bootstrap del registry de icons via
 * Vite glob eager. Basta con estar presente para que <Icon name="..."/>
 * pueda resolver este icono. No requiere tocar Icon.tsx ni el barrel.
 */
export const registration: IconEntry = {
  id: 'transport.play',
  category: 'transport',
  component: PlayIcon,
  label: 'Play',
  aliases: ['play'],
  keywords: ['playback', 'start', 'resume'],
};