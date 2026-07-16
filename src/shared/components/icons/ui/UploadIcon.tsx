import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function UploadIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Upload'}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'ui.upload',
  category: 'ui',
  component: UploadIcon,
  label: 'Upload',
  aliases: ['upload', 'import'],
  keywords: ['upload', 'import', 'load', 'file'],
};