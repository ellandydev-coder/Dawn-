// src/domain/enums/FxPluginCategory.ts

/**
 * Categorías de plugins FX (estilo REAPER).
 * Se usan para agrupar en el sidebar del FX Browser.
 */
export const FX_PLUGIN_CATEGORIES = [
  'eq',
  'dynamics',
  'reverb',
  'delay',
  'distortion',
  'modulation',
  'pitch',
  'filter',
  'utility',
  'analyzer',
  'other',
] as const;

export type FxPluginCategory = (typeof FX_PLUGIN_CATEGORIES)[number];

/** Label visible en UI para cada categoría */
export const FX_PLUGIN_CATEGORY_LABELS: Record<FxPluginCategory, string> = {
  eq: 'EQ',
  dynamics: 'Dynamics',
  reverb: 'Reverb',
  delay: 'Delay',
  distortion: 'Distortion',
  modulation: 'Modulation',
  pitch: 'Pitch',
  filter: 'Filter',
  utility: 'Utility',
  analyzer: 'Analyzer',
  other: 'Other',
};