// src/audio/recording/recorder-manifest.ts

import type { IPluginManifest } from '@domain/contracts/plugins/IPluginManifest';
import type { IParamDescriptor } from '@domain/contracts/audio/audio.types';

// ── IDs de parámetros expuestos ────────────────────────
export const PARAM_INPUT_GAIN = 'inputGain';
export const PARAM_MONITORING = 'monitoring';

// ── Rangos ─────────────────────────────────────────────
export const INPUT_GAIN_MIN = 0;
export const INPUT_GAIN_MAX = 4;
export const INPUT_GAIN_DEFAULT = 1;

// ── Manifest ───────────────────────────────────────────
export const MIC_RECORDER_MANIFEST: IPluginManifest = Object.freeze({
  id: 'dawn.mic-recorder',
  name: 'Microphone Recorder',
  version: '1.0.0',
  kind: 'recorder',
  backend: 'js',
  description:
    'Graba audio desde un micrófono o cualquier entrada del sistema.',
  author: { name: 'DAWN' },
  tags: ['recorder', 'mic', 'input'],
  latencySamples: 128,
  hasSidechain: false,
  isMidiOnly: false,
});

// ── Descriptores de parámetros ─────────────────────────
export const MIC_RECORDER_PARAM_DESCRIPTORS: readonly IParamDescriptor[] =
  Object.freeze([
    {
      id: PARAM_INPUT_GAIN,
      name: 'Input Gain',
      min: INPUT_GAIN_MIN,
      max: INPUT_GAIN_MAX,
      defaultValue: INPUT_GAIN_DEFAULT,
      scale: 'log',
      unit: 'db',
      automatable: false,
    },
    {
      id: PARAM_MONITORING,
      name: 'Monitoring',
      min: 0,
      max: 1,
      defaultValue: 0,
      scale: 'linear',
      unit: 'none',
      step: 1,
      automatable: false,
    },
  ]);