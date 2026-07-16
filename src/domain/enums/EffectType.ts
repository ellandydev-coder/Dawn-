/**
 * EffectType
 * ----------
 * Categorías de efectos de audio disponibles.
 */

export const EffectType = {
  // Dinámica
  COMPRESSOR: 'compressor',
  LIMITER:    'limiter',
  GATE:       'gate',
  EXPANDER:   'expander',

  // EQ
  EQ:         'eq',
  FILTER:     'filter',

  // Tiempo
  DELAY:      'delay',
  REVERB:     'reverb',
  CHORUS:     'chorus',
  FLANGER:    'flanger',
  PHASER:     'phaser',

  // Modulación
  TREMOLO:    'tremolo',
  VIBRATO:    'vibrato',

  // Distorsión
  DISTORTION: 'distortion',
  SATURATION: 'saturation',
  BITCRUSHER: 'bitcrusher',

  // Utilidad
  GAIN:       'gain',
  UTILITY:    'utility',
} as const;

export type EffectType = typeof EffectType[keyof typeof EffectType];

export const ALL_EFFECT_TYPES = Object.values(EffectType) as [string, ...string[]];

export const isEffectType = (value: unknown): value is EffectType =>
  typeof value === 'string' && ALL_EFFECT_TYPES.includes(value);

/** Labels legibles para UI */
export const EFFECT_TYPE_LABELS: Record<EffectType, string> = {
  [EffectType.COMPRESSOR]: 'Compressor',
  [EffectType.LIMITER]:    'Limiter',
  [EffectType.GATE]:       'Gate',
  [EffectType.EXPANDER]:   'Expander',
  [EffectType.EQ]:         'EQ',
  [EffectType.FILTER]:     'Filter',
  [EffectType.DELAY]:      'Delay',
  [EffectType.REVERB]:     'Reverb',
  [EffectType.CHORUS]:     'Chorus',
  [EffectType.FLANGER]:    'Flanger',
  [EffectType.PHASER]:     'Phaser',
  [EffectType.TREMOLO]:    'Tremolo',
  [EffectType.VIBRATO]:    'Vibrato',
  [EffectType.DISTORTION]: 'Distortion',
  [EffectType.SATURATION]: 'Saturation',
  [EffectType.BITCRUSHER]: 'Bitcrusher',
  [EffectType.GAIN]:       'Gain',
  [EffectType.UTILITY]:    'Utility',
};

// ═══════════════════════════════════════════════════════════════
// 🎯 CATEGORÍAS
// ═══════════════════════════════════════════════════════════════

export const EFFECT_CATEGORIES = {
  DYNAMICS:   [EffectType.COMPRESSOR, EffectType.LIMITER, EffectType.GATE, EffectType.EXPANDER],
  EQ:         [EffectType.EQ, EffectType.FILTER],
  TIME:       [EffectType.DELAY, EffectType.REVERB],
  MODULATION: [EffectType.CHORUS, EffectType.FLANGER, EffectType.PHASER, EffectType.TREMOLO, EffectType.VIBRATO],
  DISTORTION: [EffectType.DISTORTION, EffectType.SATURATION, EffectType.BITCRUSHER],
  UTILITY:    [EffectType.GAIN, EffectType.UTILITY],
} as const;

export type EffectCategory = keyof typeof EFFECT_CATEGORIES;

export const EFFECT_CATEGORY_LABELS: Record<EffectCategory, string> = {
  DYNAMICS:   'Dynamics',
  EQ:         'EQ',
  TIME:       'Time',
  MODULATION: 'Modulation',
  DISTORTION: 'Distortion',
  UTILITY:    'Utility',
};

/** ¿A qué categoría pertenece un tipo de efecto? */
export const getEffectCategory = (type: EffectType): EffectCategory | null => {
  for (const [category, types] of Object.entries(EFFECT_CATEGORIES)) {
    if ((types as readonly string[]).includes(type)) {
      return category as EffectCategory;
    }
  }
  return null;
};