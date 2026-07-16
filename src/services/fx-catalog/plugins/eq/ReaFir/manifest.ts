// src/services/fx-catalog/plugins/eq/ReaFir/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.reafir',
  name: 'ReaFir',
  vendor: 'DAWN',
  category: 'eq',
  format: 'built-in',
  description: 'FFT-based EQ and dynamics processor',
  version: '1.0.0',
  available: true,
};