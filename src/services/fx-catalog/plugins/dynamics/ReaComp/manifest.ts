// src/services/fx-catalog/plugins/dynamics/ReaComp/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.reacomp',
  name: 'ReaComp',
  vendor: 'DAWN',
  category: 'dynamics',
  format: 'built-in',
  description: 'Compressor with sidechain support',
  version: '1.0.0',
  available: true,
};