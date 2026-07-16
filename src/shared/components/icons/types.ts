import type { SVGProps } from 'react';

/**
 * Props comunes para todos los iconos SVG del proyecto.
 */
export type IconProps = {
  size?: number | string;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
  title?: string;
} & Omit<SVGProps<SVGSVGElement>, 'width' | 'height' | 'color'>;

/**
 * Nombres canónicos de iconos disponibles.
 */
export type IconName =
  // Transport
  | 'play' | 'pause' | 'stop' | 'record' | 'loop'
  | 'skip-back' | 'skip-forward' | 'metronome'
  // Mixer
  | 'volume' | 'volume-mute' | 'volume-low' | 'volume-high'
  | 'headphones' | 'mic'
  // Editor
  | 'scissors' | 'pencil' | 'eraser' | 'selection' | 'magnet' | 'zoom-in'
  // UI
  | 'plus' | 'minus' | 'x' | 'trash' | 'settings' | 'save'
  | 'folder' | 'file' | 'search' | 'upload'
  | 'chevron-down' | 'chevron-up' | 'chevron-left' | 'chevron-right'
  // Media
  | 'music' | 'music-note' | 'waveform' | 'piano' | 'drum' | 'guitar' | 'speaker'
  // Effects
  | 'eq' | 'compressor' | 'reverb' | 'delay' | 'filter'
  // Toolbar (REAPER-style workspace toolbar)
  | 'new-project' | 'open-project' | 'save-project' | 'info'
  | 'undo' | 'redo' | 'time-selection'
  | 'automation' | 'ripple' | 'grid-settings' | 'snap' | 'grid-visibility'
  | 'lock' | 'bypass'
  | 'link' | 'envelope';