// src/services/fx-catalog/plugins/eq/ReaEQ/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.reaeq',
  name: 'ReaEQ',
  vendor: 'DAWN',
  category: 'eq',
  format: 'built-in',
  description: 'Parametric equalizer with unlimited bands',
  version: '1.0.0',
  available: true,
};