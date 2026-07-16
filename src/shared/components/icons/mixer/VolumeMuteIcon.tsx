import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function VolumeMuteIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Muted'}>
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'mixer.volume-mute',
  category: 'mixer',
  component: VolumeMuteIcon,
  label: 'Volume Mute',
  aliases: ['volume-mute', 'mute'],
  keywords: ['volume', 'mute', 'silent', 'off'],
};