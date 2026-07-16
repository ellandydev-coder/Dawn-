// src/services/fx-catalog/plugins/reverb/ReaVerb/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.reaverb',
  name: 'ReaVerb',
  vendor: 'DAWN',
  category: 'reverb',
  format: 'built-in',
  description: 'Convolution reverb',
  version: '1.0.0',
  available: true,
};