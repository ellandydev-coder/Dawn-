import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function AutomationIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Automatización'}>
      <path d="M3 12 Q 7 6, 12 12 T 21 12" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'toolbar.automation',
  category: 'toolbar',
  component: AutomationIcon,
  label: 'Automation',
  aliases: ['automation'],
  keywords: ['automation', 'curve', 'wave', 'auto'],
};