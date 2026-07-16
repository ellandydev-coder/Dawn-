// src/services/fx-catalog/plugins/pitch/ReaTune/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.reatune',
  name: 'ReaTune',
  vendor: 'DAWN',
  category: 'pitch',
  format: 'built-in',
  description: 'Auto-tune / pitch correction',
  version: '1.0.0',
  available: false,
};