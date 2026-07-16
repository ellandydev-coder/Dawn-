import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function RippleIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Ripple editing'}>
      {/* Primera S */}
      <path d="M4 8 Q 8 8, 8 12 T 12 16" />
      {/* Segunda S */}
      <path d="M12 8 Q 16 8, 16 12 T 20 16" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'toolbar.ripple',
  category: 'toolbar',
  component: RippleIcon,
  label: 'Ripple',
  aliases: ['ripple'],
  keywords: ['ripple', 'edit', 'shift', 'move'],
};