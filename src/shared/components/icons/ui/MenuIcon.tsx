import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function MenuIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Menu'}>
      <line x1="3"  y1="6"  x2="21" y2="6"  />
      <line x1="3"  y1="12" x2="21" y2="12" />
      <line x1="3"  y1="18" x2="21" y2="18" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'ui.menu',
  category: 'ui',
  component: MenuIcon,
  label: 'Menu',
  aliases: ['menu', 'hamburger'],
  keywords: ['menu', 'hamburger', 'bars', 'navigation'],
};