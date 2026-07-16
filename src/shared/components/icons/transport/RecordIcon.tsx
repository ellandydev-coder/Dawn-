import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function RecordIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Record'}>
      {/* Anillo exterior */}
      <circle cx="12" cy="12" r="9" fill="none" />
      {/* Círculo interior relleno */}
      <circle cx="12" cy="12" r="5" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'transport.record',
  category: 'transport',
  component: RecordIcon,
  label: 'Record',
  aliases: ['record'],
  keywords: ['capture', 'rec', 'input'],
};