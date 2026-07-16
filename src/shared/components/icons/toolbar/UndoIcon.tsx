import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function UndoIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Deshacer'}>
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6.71 3L3 13" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'toolbar.undo',
  category: 'toolbar',
  component: UndoIcon,
  label: 'Undo',
  aliases: ['undo'],
  keywords: ['revert', 'back', 'history'],
};