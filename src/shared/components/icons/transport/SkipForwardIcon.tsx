import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function SkipForwardIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Skip forward'}>
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'transport.skip-forward',
  category: 'transport',
  component: SkipForwardIcon,
  label: 'Skip Forward',
  aliases: ['skip-forward', 'next', 'forward'],
  keywords: ['forward', 'next', 'skip'],
};