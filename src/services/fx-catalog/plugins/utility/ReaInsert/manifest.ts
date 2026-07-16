// src/services/fx-catalog/plugins/utility/ReaInsert/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.reainsert',
  name: 'ReaInsert',
  vendor: 'DAWN',
  category: 'utility',
  format: 'built-in',
  description: 'Hardware insert (send/return)',
  version: '1.0.0',
  available: false,
};