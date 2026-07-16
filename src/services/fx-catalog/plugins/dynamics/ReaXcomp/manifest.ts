// src/services/fx-catalog/plugins/dynamics/ReaXcomp/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.reaxcomp',
  name: 'ReaXcomp',
  vendor: 'DAWN',
  category: 'dynamics',
  format: 'built-in',
  description: 'Multiband compressor',
  version: '1.0.0',
  available: false,
};