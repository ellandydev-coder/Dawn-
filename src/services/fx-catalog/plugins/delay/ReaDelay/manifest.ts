// src/services/fx-catalog/plugins/delay/ReaDelay/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.readelay',
  name: 'ReaDelay',
  vendor: 'DAWN',
  category: 'delay',
  format: 'built-in',
  description: 'Multi-tap delay with feedback',
  version: '1.0.0',
  available: true,
};