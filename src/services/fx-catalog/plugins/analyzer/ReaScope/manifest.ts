// src/services/fx-catalog/plugins/analyzer/ReaScope/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.reascope',
  name: 'ReaScope',
  vendor: 'DAWN',
  category: 'analyzer',
  format: 'built-in',
  description: 'Oscilloscope + spectrum analyzer',
  version: '1.0.0',
  available: false,
};