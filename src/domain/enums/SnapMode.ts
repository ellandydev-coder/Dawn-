/**
 * SnapMode
 * --------
 * Modos de snap del cursor y clips en el timeline.
 */

export const SnapMode = {
  OFF:       'off',
  GRID:      'grid',
  BAR:       'bar',
  BEAT:      'beat',
  SIXTEENTH: 'sixteenth',
  CLIP:      'clip',
  MARKER:    'marker',
} as const;

export type SnapMode = typeof SnapMode[keyof typeof SnapMode];

export const ALL_SNAP_MODES = Object.values(SnapMode) as [string, ...string[]];

export const isSnapMode = (value: unknown): value is SnapMode =>
  typeof value === 'string' && ALL_SNAP_MODES.includes(value);

export const SNAP_MODE_LABELS: Record<SnapMode, string> = {
  [SnapMode.OFF]:       'Off',
  [SnapMode.GRID]:      'Grid',
  [SnapMode.BAR]:       'Bar',
  [SnapMode.BEAT]:      'Beat',
  [SnapMode.SIXTEENTH]: '1/16',
  [SnapMode.CLIP]:      'Clip',
  [SnapMode.MARKER]:    'Marker',
};

/** Subdivisión en beats para cada modo (útil para snap math) */
export const SNAP_MODE_BEATS: Partial<Record<SnapMode, number>> = {
  [SnapMode.BAR]:       4,
  [SnapMode.BEAT]:      1,
  [SnapMode.SIXTEENTH]: 0.25,
};

/** ¿Este modo usa tiempo musical (beats)? */
export const isMusicalSnap = (mode: SnapMode): boolean =>
  mode === SnapMode.BAR ||
  mode === SnapMode.BEAT ||
  mode === SnapMode.SIXTEENTH ||
  mode === SnapMode.GRID;