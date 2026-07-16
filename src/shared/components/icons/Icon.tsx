import type { ComponentType } from 'react';
import type { IconName, IconProps } from './types';

// Transport
import { PlayIcon } from './transport/PlayIcon';
import { PauseIcon } from './transport/PauseIcon';
import { StopIcon } from './transport/StopIcon';
import { RecordIcon } from './transport/RecordIcon';
import { SkipBackIcon } from './transport/SkipBackIcon';
import { SkipForwardIcon } from './transport/SkipForwardIcon';
import { LoopIcon } from './transport/LoopIcon';
import { MetronomeIcon } from './transport/MetronomeIcon';

// Mixer
import { VolumeIcon } from './mixer/VolumeIcon';
import { VolumeMuteIcon } from './mixer/VolumeMuteIcon';
import { VolumeLowIcon } from './mixer/VolumeLowIcon';
import { HeadphonesIcon } from './mixer/HeadphonesIcon';
import { MicIcon } from './mixer/MicIcon';

// UI
import { PlusIcon } from './ui/PlusIcon';
import { XIcon } from './ui/XIcon';
import { TrashIcon } from './ui/TrashIcon';
import { SettingsIcon } from './ui/SettingsIcon';
import { SaveIcon } from './ui/SaveIcon';
import { UploadIcon } from './ui/UploadIcon';
import { FolderIcon } from './ui/FolderIcon';

// Media
import { MusicNoteIcon } from './media/MusicNoteIcon';
import { WaveformIcon } from './media/WaveformIcon';

// Toolbar (REAPER-style)
import { NewProjectIcon } from './toolbar/NewProjectIcon';
import { OpenProjectIcon } from './toolbar/OpenProjectIcon';
import { SaveProjectIcon } from './toolbar/SaveProjectIcon';
import { InfoIcon } from './toolbar/InfoIcon';
import { UndoIcon } from './toolbar/UndoIcon';
import { RedoIcon } from './toolbar/RedoIcon';
import { TimeSelectionIcon } from './toolbar/TimeSelectionIcon';
import { AutomationIcon } from './toolbar/AutomationIcon';
import { RippleIcon } from './toolbar/RippleIcon';
import { GridSettingsIcon } from './toolbar/GridSettingsIcon';
import { SnapIcon } from './toolbar/SnapIcon';
import { GridVisibilityIcon } from './toolbar/GridVisibilityIcon';
import { LockIcon } from './toolbar/LockIcon';
import { BypassIcon } from './toolbar/BypassIcon';
import { ScissorsIcon } from './toolbar/ScissorsIcon';
import { LinkIcon } from './toolbar/LinkIcon';
import { EnvelopeIcon } from './toolbar/EnvelopeIcon';

type DynamicIconProps = IconProps & {
  name: IconName;
};

/**
 * Mapa: nombre → componente SVG.
 */
const ICON_MAP: Partial<Record<IconName, ComponentType<IconProps>>> = {
  // Transport
  play: PlayIcon,
  pause: PauseIcon,
  stop: StopIcon,
  record: RecordIcon,
  'skip-back': SkipBackIcon,
  'skip-forward': SkipForwardIcon,
  loop: LoopIcon,
  metronome: MetronomeIcon,

  // Mixer
  volume: VolumeIcon,
  'volume-mute': VolumeMuteIcon,
  'volume-low': VolumeLowIcon,
  headphones: HeadphonesIcon,
  mic: MicIcon,

  // UI
  plus: PlusIcon,
  x: XIcon,
  trash: TrashIcon,
  settings: SettingsIcon,
  save: SaveIcon,
  upload: UploadIcon,
  folder: FolderIcon,

  // Media
  music: MusicNoteIcon,
  'music-note': MusicNoteIcon,
  waveform: WaveformIcon,

  // Toolbar (REAPER-style)
  'new-project': NewProjectIcon,
  'open-project': OpenProjectIcon,
  'save-project': SaveProjectIcon,
  info: InfoIcon,
  undo: UndoIcon,
  redo: RedoIcon,
  'time-selection': TimeSelectionIcon,
  automation: AutomationIcon,
  ripple: RippleIcon,
  'grid-settings': GridSettingsIcon,
  snap: SnapIcon,
  'grid-visibility': GridVisibilityIcon,
  lock: LockIcon,
  bypass: BypassIcon,
  scissors: ScissorsIcon,
  link: LinkIcon,
  envelope: EnvelopeIcon,
};

/**
 * Icon
 * ----
 * Componente genérico que renderiza un icono SVG por nombre.
 *
 * @example
 *   <Icon name="play" size={16} color="#7a8cff" />
 */
export function Icon({ name, ...props }: DynamicIconProps) {
  const IconComponent = ICON_MAP[name];

  if (!IconComponent) {
    console.warn(`[Icon] Icono desconocido: "${name}"`);
    return null;
  }

  return <IconComponent {...props} />;
}