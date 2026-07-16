// src/services/fx-catalog/builtInFxCatalog.ts

import type { FxPluginInfo } from '@domain/models/FxPluginInfo';

/**
 * Catálogo built-in de plugins FX que vienen con DAWN.
 *
 * Por ahora son "fake" — solo metadatos. Cuando implementemos el
 * motor real de efectos (FASE futura), cada uno tendrá su clase
 * que implemente IAudioEffect y se conectará al EffectChain.
 */
export const BUILT_IN_FX_CATALOG: readonly FxPluginInfo[] = [
  // ─── EQ ─────────────────────────────────────────
  {
    id: 'built-in.reaeq',
    name: 'ReaEQ',
    vendor: 'DAWN',
    category: 'eq',
    format: 'built-in',
    description: 'Parametric equalizer with unlimited bands',
    version: '1.0.0',
    available: true,
  },
  {
    id: 'built-in.reafir',
    name: 'ReaFir',
    vendor: 'DAWN',
    category: 'eq',
    format: 'built-in',
    description: 'FFT-based EQ and dynamics processor',
    version: '1.0.0',
    available: true,
  },

  // ─── DYNAMICS ───────────────────────────────────
  {
    id: 'built-in.reacomp',
    name: 'ReaComp',
    vendor: 'DAWN',
    category: 'dynamics',
    format: 'built-in',
    description: 'Compressor with sidechain support',
    version: '1.0.0',
    available: true,
  },
  {
    id: 'built-in.reagate',
    name: 'ReaGate',
    vendor: 'DAWN',
    category: 'dynamics',
    format: 'built-in',
    description: 'Noise gate with hysteresis',
    version: '1.0.0',
    available: true,
  },
  {
    id: 'built-in.realimit',
    name: 'ReaLimit',
    vendor: 'DAWN',
    category: 'dynamics',
    format: 'built-in',
    description: 'Brick-wall limiter',
    version: '1.0.0',
    available: true,
  },
  {
    id: 'built-in.reaxcomp',
    name: 'ReaXcomp',
    vendor: 'DAWN',
    category: 'dynamics',
    format: 'built-in',
    description: 'Multiband compressor',
    version: '1.0.0',
    available: false,
  },

  // ─── REVERB ─────────────────────────────────────
  {
    id: 'built-in.reaverb',
    name: 'ReaVerb',
    vendor: 'DAWN',
    category: 'reverb',
    format: 'built-in',
    description: 'Convolution reverb',
    version: '1.0.0',
    available: true,
  },
  {
    id: 'built-in.reaverbate',
    name: 'ReaVerbate',
    vendor: 'DAWN',
    category: 'reverb',
    format: 'built-in',
    description: 'Algorithmic reverb',
    version: '1.0.0',
    available: false,
  },

  // ─── DELAY ──────────────────────────────────────
  {
    id: 'built-in.readelay',
    name: 'ReaDelay',
    vendor: 'DAWN',
    category: 'delay',
    format: 'built-in',
    description: 'Multi-tap delay with feedback',
    version: '1.0.0',
    available: true,
  },

  // ─── DISTORTION ─────────────────────────────────
  {
    id: 'built-in.readist',
    name: 'ReaDist',
    vendor: 'DAWN',
    category: 'distortion',
    format: 'built-in',
    description: 'Distortion and saturation',
    version: '1.0.0',
    available: false,
  },

  // ─── PITCH ──────────────────────────────────────
  {
    id: 'built-in.reapitch',
    name: 'ReaPitch',
    vendor: 'DAWN',
    category: 'pitch',
    format: 'built-in',
    description: 'Pitch shifter',
    version: '1.0.0',
    available: false,
  },
  {
    id: 'built-in.reatune',
    name: 'ReaTune',
    vendor: 'DAWN',
    category: 'pitch',
    format: 'built-in',
    description: 'Auto-tune / pitch correction',
    version: '1.0.0',
    available: false,
  },

  // ─── UTILITY ────────────────────────────────────
  {
    id: 'built-in.reainsert',
    name: 'ReaInsert',
    vendor: 'DAWN',
    category: 'utility',
    format: 'built-in',
    description: 'Hardware insert (send/return)',
    version: '1.0.0',
    available: false,
  },
  {
    id: 'built-in.reacontrolmidi',
    name: 'ReaControlMIDI',
    vendor: 'DAWN',
    category: 'utility',
    format: 'built-in',
    description: 'MIDI control mapper',
    version: '1.0.0',
    available: false,
  },

  // ─── ANALYZER ───────────────────────────────────
  {
    id: 'built-in.reascope',
    name: 'ReaScope',
    vendor: 'DAWN',
    category: 'analyzer',
    format: 'built-in',
    description: 'Oscilloscope + spectrum analyzer',
    version: '1.0.0',
    available: false,
  },
];