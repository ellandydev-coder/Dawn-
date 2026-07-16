import { IconBase } from '../IconBase';
import type { IconProps } from '../types';
import type { IconEntry } from '../registry';

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function MusicNoteIcon(props: IconProps) {
  return (
    <IconBase {...props} title={props.title ?? 'Music'}>
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" fill="currentColor" />
      <circle cx="18" cy="16" r="3" fill="currentColor" />
    </IconBase>
  );
}

// ═══════════════════════════════════════════════════════════════
// 📌 REGISTRO AUTO-DESCUBIERTO
// ═══════════════════════════════════════════════════════════════

/*
 * Nota: incluye DOS aliases para retrocompatibilidad total
 * con el ICON_MAP viejo, que tenía "music" y "music-note"
 * apuntando al mismo componente.
 */
export const registration: IconEntry = {
  id: 'media.music-note',
  category: 'media',
  component: MusicNoteIcon,
  label: 'Music Note',
  aliases: ['music', 'music-note'],
  keywords: ['song', 'audio', 'melody', 'note'],
};