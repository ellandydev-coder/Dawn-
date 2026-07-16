import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function SkipBackIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Skip back'}>
      <polygon points="19 20 9 12 19 4 19 20" fill="currentColor" />
      <line x1="5" y1="19" x2="5" y2="5" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'transport.skip-back',
  category: 'transport',
  component: SkipBackIcon,
  label: 'Skip Back',
  aliases: ['skip-back', 'previous', 'rewind'],
  keywords: ['back', 'previous', 'rewind', 'prev'],
};