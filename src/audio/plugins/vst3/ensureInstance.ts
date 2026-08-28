// src/services/plugins/vst3/ensureInstance.ts

import { vst3Commands } from './invoke';
import type { Vst3ClassInfo, Vst3LoadResult } from './types';

const AUDIO_MODULE_CATEGORY_PREFIX = 'Audio Module Class';

export async function loadPluginEnsuringClasses(bundlePath: string): Promise<Vst3LoadResult> {
  let load = await vst3Commands.loadPlugin(bundlePath);
  if (!load.success || !load.plugin_key) {
    throw new Error(`Load falló para "${bundlePath}": ${load.message}`);
  }

  if (load.classes.length > 0) return load;

  await vst3Commands.unloadPlugin(load.plugin_key);
  load = await vst3Commands.loadPlugin(bundlePath);
  if (!load.success || !load.plugin_key) {
    throw new Error(`Reload falló para "${bundlePath}": ${load.message}`);
  }
  return load;
}

export function findAudioModuleClass(load: Vst3LoadResult): Vst3ClassInfo | null {
  return (
    load.classes.find(c => c.category === AUDIO_MODULE_CATEGORY_PREFIX) ??
    load.classes.find(c => c.category.startsWith(AUDIO_MODULE_CATEGORY_PREFIX)) ??
    null
  );
}

export async function ensureInstance(bundlePath: string, instanceId: string): Promise<void> {
  const load = await loadPluginEnsuringClasses(bundlePath);
  const pluginKey = load.plugin_key!;

  const instances = await vst3Commands.listInstances(pluginKey);
  const existing = instances.find(i => i.instance_id === instanceId);

  if (existing) {
    if (!existing.initialized) {
      await vst3Commands.initializeInstance(pluginKey, instanceId);
    }
    return;
  }

  const audioClass = findAudioModuleClass(load);
  if (!audioClass) {
    throw new Error(`No Audio Module Class found in "${bundlePath}"`);
  }

  const create = await vst3Commands.createInstance(pluginKey, audioClass.cid, instanceId);
  if (!create.success || !create.instance_id) {
    throw new Error(`createInstance failed: ${create.message}`);
  }

  const init = await vst3Commands.initializeInstance(pluginKey, instanceId);
  if (!init.success) {
    await vst3Commands.releaseInstance(pluginKey, instanceId);
    throw new Error(`initializeInstance failed: ${init.message}`);
  }
}