/**
 * ClipType
 * --------
 * Tipos de clip que pueden existir en el timeline.
 *
 * - AUDIO:      Clip de audio (referencia a un asset)
 * - MIDI:       Clip MIDI (contiene notas)
 * - AUTOMATION: Clip de automatización (puntos sobre un parámetro)
 */

export const ClipType = {
  AUDIO:      'audio',
  MIDI:       'midi',
  AUTOMATION: 'automation',
} as const;

export type ClipType = typeof ClipType[keyof typeof ClipType];

export const ALL_CLIP_TYPES = Object.values(ClipType) as [string, ...string[]];

export const isClipType = (value: unknown): value is ClipType =>
  typeof value === 'string' && ALL_CLIP_TYPES.includes(value);

/** Labels legibles */
export const CLIP_TYPE_LABELS: Record<ClipType, string> = {
  [ClipType.AUDIO]:      'Audio',
  [ClipType.MIDI]:       'MIDI',
  [ClipType.AUTOMATION]: 'Automation',
};

/** ¿Este clip contiene audio real? */
export const hasAudioContent = (type: ClipType): boolean =>
  type === ClipType.AUDIO;

/** ¿Este clip contiene notas MIDI? */
export const hasMidiContent = (type: ClipType): boolean =>
  type === ClipType.MIDI;