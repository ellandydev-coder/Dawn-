// src/services/fx-catalog/plugins/distortion/ReaDist/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.readist',
  name: 'ReaDist',
  vendor: 'DAWN',
  category: 'distortion',
  format: 'built-in',
  description: 'Distortion and saturation',
  version: '1.0.0',
  available: false,
};