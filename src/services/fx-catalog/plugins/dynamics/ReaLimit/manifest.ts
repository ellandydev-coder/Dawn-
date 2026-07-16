// src/services/fx-catalog/plugins/dynamics/ReaLimit/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.realimit',
  name: 'ReaLimit',
  vendor: 'DAWN',
  category: 'dynamics',
  format: 'built-in',
  description: 'Brick-wall limiter',
  version: '1.0.0',
  available: true,
};