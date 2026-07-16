// src/services/fx-catalog/plugins/utility/ReaControlMIDI/manifest.ts

import type { FxPluginRegistration } from '../../../registry';

export const registration: FxPluginRegistration = {
  id: 'built-in.reacontrolmidi',
  name: 'ReaControlMIDI',
  vendor: 'DAWN',
  category: 'utility',
  format: 'built-in',
  description: 'MIDI control mapper',
  version: '1.0.0',
  available: false,
};