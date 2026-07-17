// src/features/fx-chain/hooks/useVst3.ts
//
// Hook React para gestionar el ciclo de vida de un plugin VST3.

import { useState, useCallback, useRef } from 'react';
import { vst3Bridge } from '../../../services/plugins/vst3Bridge';

export type Vst3Status =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'editor_open'
  | 'error';

export interface Vst3PluginState {
  status:     Vst3Status;
  pluginKey:  string | null;
  instanceId: string | null;
  width:      number;
  height:     number;
  error:      string | null;
}

const INITIAL_STATE: Vst3PluginState = {
  status:     'idle',
  pluginKey:  null,
  instanceId: null,
  width:      0,
  height:     0,
  error:      null,
};

export function useVst3(bundlePath: string) {
  const [state, setState] = useState<Vst3PluginState>(INITIAL_STATE);

  // Ref para evitar operaciones en paralelo
  const operationRef = useRef(false);

  const openEditor = useCallback(async () => {
    if (operationRef.current) return;
    if (state.status === 'editor_open') return;

    operationRef.current = true;
    setState(s => ({ ...s, status: 'loading', error: null }));

    try {
      const result = await vst3Bridge.loadAndInit(bundlePath);

      setState({
        status:     'editor_open',
        pluginKey:  result.pluginKey,
        instanceId: result.instanceId,
        width:      result.width,
        height:     result.height,
        error:      null,
      });
    } catch (err) {
      setState(s => ({
        ...s,
        status: 'error',
        error:  err instanceof Error ? err.message : String(err),
      }));
    } finally {
      operationRef.current = false;
    }
  }, [bundlePath, state.status]);

  const closeEditor = useCallback(async () => {
    if (operationRef.current) return;
    if (!state.pluginKey || !state.instanceId) return;

    operationRef.current = true;

    try {
      await vst3Bridge.closeAndUnload(state.pluginKey, state.instanceId);
      setState(INITIAL_STATE);
    } catch (err) {
      console.error('[useVst3] closeEditor error:', err);
      // Reset de todas formas
      setState(INITIAL_STATE);
    } finally {
      operationRef.current = false;
    }
  }, [state.pluginKey, state.instanceId]);

  return {
    ...state,
    openEditor,
    closeEditor,
  };
}