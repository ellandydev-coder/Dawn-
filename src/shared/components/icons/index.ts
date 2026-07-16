// ============================================================
// ICONS - Barrel export
// ============================================================
// Import directo (tree-shakeable):
//   import { PlayIcon, VolumeIcon } from '@shared/components/icons';
//
// Import genérico (para nombres dinámicos):
//   import { Icon } from '@shared/components/icons';
//   <Icon name="play" size={16} />
// ============================================================

// Tipos y base
export type { IconProps, IconName } from './types';
export { IconBase } from './IconBase';


// ============ TRANSPORT ============
export { PlayIcon } from './transport/PlayIcon';
export { PauseIcon } from './transport/PauseIcon';
export { StopIcon } from './transport/StopIcon';
export { RecordIcon } from './transport/RecordIcon';
export { SkipBackIcon } from './transport/SkipBackIcon';
export { SkipForwardIcon } from './transport/SkipForwardIcon';
export { LoopIcon } from './transport/LoopIcon';
export { MetronomeIcon } from './transport/MetronomeIcon';

// ============ MIXER ============
export { VolumeIcon } from './mixer/VolumeIcon';
export { VolumeMuteIcon } from './mixer/VolumeMuteIcon';
export { VolumeLowIcon } from './mixer/VolumeLowIcon';
export { HeadphonesIcon } from './mixer/HeadphonesIcon';
export { MicIcon } from './mixer/MicIcon';

// ============ UI ============
export { PlusIcon } from './ui/PlusIcon';
export { XIcon } from './ui/XIcon';
export { TrashIcon } from './ui/TrashIcon';
export { SettingsIcon } from './ui/SettingsIcon';
export { SaveIcon } from './ui/SaveIcon';
export { UploadIcon } from './ui/UploadIcon';
export { FolderIcon } from './ui/FolderIcon';
export { MenuIcon } from './ui/MenuIcon';

// ============ MEDIA ============
export { MusicNoteIcon } from './media/MusicNoteIcon';
export { WaveformIcon } from './media/WaveformIcon';

// ============ BRANDING ============
export { LogoIcon } from './branding/LogoIcon';
export type { LogoIconProps } from './branding/LogoIcon';

// ============ TOOLBAR (REAPER-style) ============
export { NewProjectIcon } from './toolbar/NewProjectIcon';
export { OpenProjectIcon } from './toolbar/OpenProjectIcon';
export { SaveProjectIcon } from './toolbar/SaveProjectIcon';
export { InfoIcon } from './toolbar/InfoIcon';
export { UndoIcon } from './toolbar/UndoIcon';
export { RedoIcon } from './toolbar/RedoIcon';
export { TimeSelectionIcon } from './toolbar/TimeSelectionIcon';
export { AutomationIcon } from './toolbar/AutomationIcon';
export { RippleIcon } from './toolbar/RippleIcon';
export { GridSettingsIcon } from './toolbar/GridSettingsIcon';
export { SnapIcon } from './toolbar/SnapIcon';
export { GridVisibilityIcon } from './toolbar/GridVisibilityIcon';
export { LockIcon } from './toolbar/LockIcon';
export { BypassIcon } from './toolbar/BypassIcon';
export { ScissorsIcon } from './toolbar/ScissorsIcon';
export { LinkIcon } from './toolbar/LinkIcon';
export { EnvelopeIcon } from './toolbar/EnvelopeIcon';