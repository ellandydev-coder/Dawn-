// src/services/plugins/vst3/index.ts

import { vst3Commands } from './invoke';
import { loadPluginEnsuringClasses, findAudioModuleClass, ensureInstance } from './ensureInstance';
import { closeAndUnload } from './lifecycle';

export * from './types';

export const vst3Bridge = {
  ...vst3Commands,
  loadPluginEnsuringClasses,
  findAudioModuleClass,
  ensureInstance,
  closeAndUnload,
};