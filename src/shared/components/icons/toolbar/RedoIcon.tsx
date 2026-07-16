import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function RedoIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Rehacer'}>
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6.71 3L21 13" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'toolbar.redo',
  category: 'toolbar',
  component: RedoIcon,
  label: 'Redo',
  aliases: ['redo'],
  keywords: ['redo', 'forward', 'history', 'repeat'],
};