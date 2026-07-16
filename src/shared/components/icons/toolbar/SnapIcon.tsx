import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function SnapIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Snap a la grid'}>
      {/* Cruz vertical/horizontal */}
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="4" y1="12" x2="20" y2="12" />
      {/* Cruz diagonal */}
      <line x1="6.3" y1="6.3" x2="17.7" y2="17.7" />
      <line x1="17.7" y1="6.3" x2="6.3" y2="17.7" />
      {/* Punto central */}
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'toolbar.snap',
  category: 'toolbar',
  component: SnapIcon,
  label: 'Snap',
  aliases: ['snap', 'magnet'],
  keywords: ['snap', 'grid', 'align', 'magnet'],
};