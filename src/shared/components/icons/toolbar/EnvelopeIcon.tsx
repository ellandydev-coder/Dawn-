import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function EnvelopeIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Envolvente'}>
      <path d="M4 15c0-4 3-8 8-8s8 4 8 8" />
      <polyline points="17 12 20 15 17 18" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'toolbar.envelope',
  category: 'toolbar',
  component: EnvelopeIcon,
  label: 'Envelope',
  aliases: ['envelope', 'automation-curve'],
  keywords: ['envelope', 'automation', 'curve', 'modulation'],
};