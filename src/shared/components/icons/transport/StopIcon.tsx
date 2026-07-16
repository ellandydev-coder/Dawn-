import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function StopIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Stop'}>
      <rect x="6" y="6" width="12" height="12" fill="currentColor" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'transport.stop',
  category: 'transport',
  component: StopIcon,
  label: 'Stop',
  aliases: ['stop'],
  keywords: ['playback', 'halt', 'end'],
};