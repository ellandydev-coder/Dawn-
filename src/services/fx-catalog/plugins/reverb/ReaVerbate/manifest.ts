// src/services/fx-catalog/plugins/reverb/ReaVerbate/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.reaverbate',
  name: 'ReaVerbate',
  vendor: 'DAWN',
  category: 'reverb',
  format: 'built-in',
  description: 'Algorithmic reverb',
  version: '1.0.0',
  available: false,
};