// src/services/fx-catalog/plugins/pitch/ReaPitch/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.reapitch',
  name: 'ReaPitch',
  vendor: 'DAWN',
  category: 'pitch',
  format: 'built-in',
  description: 'Pitch shifter',
  version: '1.0.0',
  available: false,
};