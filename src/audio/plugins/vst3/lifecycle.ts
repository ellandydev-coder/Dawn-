// src/services/plugins/vst3/lifecycle.ts

import { vst3Commands } from './invoke';
import { loadPluginEnsuringClasses, findAudioModuleClass } from './ensureInstance';

export interface LoadAndInitResult {
  pluginKey: string;
  instanceId: string;
  width: number;
  height: number;
}

export async function loadAndInit(bundlePath: string): Promise<LoadAndInitResult> {
  const load = await loadPluginEnsuringClasses(bundlePath);
  const pluginKey = load.plugin_key;
  if (!pluginKey) {
    throw new Error(`Plugin key no devuelta al cargar "${bundlePath}"`);
  }

  const audioClass = findAudioModuleClass(load);
  if (!audioClass) {
    throw new Error(`No Audio Module Class found in "${bundlePath}"`);
  }

  const create = await vst3Commands.createInstance(pluginKey, audioClass.cid);
  if (!create.success || !create.instance_id) {
    throw new Error(`createInstance falló: ${create.message}`);
  }
  const instanceId = create.instance_id;

  const init = await vst3Commands.initializeInstance(pluginKey, instanceId);
  if (!init.success) {
    await vst3Commands.releaseInstance(pluginKey, instanceId);
    throw new Error(`initializeInstance falló: ${init.message}`);
  }

  const editor = await vst3Commands.openEditor(pluginKey, instanceId);
  if (!editor.success) {
    throw new Error(`openEditor falló: ${editor.message}`);
  }

  return {
    pluginKey,
    instanceId,
    width: editor.width ?? 0,
    height: editor.height ?? 0,
  };
}

export async function closeAndUnload(pluginKey: string, instanceId: string): Promise<void> {
  const step = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch (e) {
      console.warn(`[vst3.closeAndUnload] ${label} falló:`, e);
    }
  };

  await step('closeEditor', () => vst3Commands.closeEditor(pluginKey, instanceId));
  await step('terminateInstance', () => vst3Commands.terminateInstance(pluginKey, instanceId));
  await step('releaseInstance', () => vst3Commands.releaseInstance(pluginKey, instanceId));
  await step('unloadPlugin', () => vst3Commands.unloadPlugin(pluginKey));
}
