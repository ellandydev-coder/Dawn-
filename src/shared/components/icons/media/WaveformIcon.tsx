import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function WaveformIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Waveform'}>
      <line x1="2" y1="12" x2="2" y2="12" />
      <line x1="5" y1="8" x2="5" y2="16" />
      <line x1="8" y1="4" x2="8" y2="20" />
      <line x1="11" y1="10" x2="11" y2="14" />
      <line x1="14" y1="6" x2="14" y2="18" />
      <line x1="17" y1="9" x2="17" y2="15" />
      <line x1="20" y1="5" x2="20" y2="19" />
      <line x1="23" y1="11" x2="23" y2="13" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

export const registration: IconEntry = {
  id: 'media.waveform',
  category: 'media',
  component: WaveformIcon,
  label: 'Waveform',
  aliases: ['waveform', 'wave'],
  keywords: ['waveform', 'wave', 'audio', 'signal'],
};