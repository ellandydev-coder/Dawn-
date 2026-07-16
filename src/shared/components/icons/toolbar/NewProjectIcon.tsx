import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function NewProjectIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Nuevo proyecto'}>
      {/* Hoja con esquina doblada arriba-derecha */}
      <path d="M14 3 H6 a2 2 0 0 0 -2 2 V19 a2 2 0 0 0 2 2 H18 a2 2 0 0 0 2 -2 V9 Z" />
      <path d="M14 3 V9 H20" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'toolbar.new-project',
  category: 'toolbar',
  component: NewProjectIcon,
  label: 'New Project',
  aliases: ['new-project', 'new'],
  keywords: ['new', 'project', 'create', 'file'],
};