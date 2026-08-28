// src/services/plugins/vst3/lifecycle.ts

import { vst3Commands } from './invoke';

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