// src/services/fx-catalog/plugins/dynamics/ReaGate/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.reagate',
  name: 'ReaGate',
  vendor: 'DAWN',
  category: 'dynamics',
  format: 'built-in',
  description: 'Noise gate with hysteresis',
  version: '1.0.0',
  available: true,
};