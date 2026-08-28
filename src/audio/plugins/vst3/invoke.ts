// src/services/plugins/vst3/invoke.ts

import { invoke } from '@tauri-apps/api/core';
import type {
  Vst3LoadResult,
  Vst3CreateResult,
  Vst3InitResult,
  Vst3InstanceInfo,
  Vst3OpenEditorResult,
  Vst3ActivateProcessingResult,
  Vst3ProcessBlockResult,
} from './types';

export const vst3Commands = {
  loadPlugin(bundlePath: string): Promise<Vst3LoadResult> {
    return invoke<Vst3LoadResult>('vst3_load_plugin', { bundlePath });
  },

  unloadPlugin(pluginKey: string): Promise<boolean> {
    return invoke<boolean>('vst3_unload_plugin', { pluginKey });
  },

  listLoaded(): Promise<string[]> {
    return invoke<string[]>('vst3_list_loaded');
  },

  createInstance(
    pluginKey: string,
    classCid: string,
    instanceId?: string
  ): Promise<Vst3CreateResult> {
    return invoke<Vst3CreateResult>('vst3_create_instance', {
      pluginKey,
      classCid,
      instanceId,
    });
  },

  initializeInstance(
    pluginKey: string,
    instanceId: string
  ): Promise<Vst3InitResult> {
    return invoke<Vst3InitResult>('vst3_initialize_instance', {
      pluginKey,
      instanceId,
    });
  },

  terminateInstance(pluginKey: string, instanceId: string): Promise<boolean> {
    return invoke<boolean>('vst3_terminate_instance', {
      pluginKey,
      instanceId,
    });
  },

  releaseInstance(pluginKey: string, instanceId: string): Promise<boolean> {
    return invoke<boolean>('vst3_release_instance', {
      pluginKey,
      instanceId,
    });
  },

  listInstances(pluginKey: string): Promise<Vst3InstanceInfo[]> {
    return invoke<Vst3InstanceInfo[]>('vst3_list_instances', { pluginKey });
  },

  openEditor(
    pluginKey: string,
    instanceId: string,
    x?: number,
    y?: number,
    width?: number,
    height?: number
  ): Promise<Vst3OpenEditorResult> {
    return invoke<Vst3OpenEditorResult>('vst3_open_editor', {
      pluginKey,
      instanceId,
      x,
      y,
      width,
      height,
    });
  },

  updateEditorBounds(
    pluginKey: string,
    instanceId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): Promise<boolean> {
    return invoke<boolean>('vst3_update_editor_bounds', {
      pluginKey,
      instanceId,
      x,
      y,
      width,
      height,
    });
  },

  closeEditor(pluginKey: string, instanceId: string): Promise<boolean> {
    return invoke<boolean>('vst3_close_editor', {
      pluginKey,
      instanceId,
    });
  },

  /**
   * QI IAudioProcessor + setupProcessing + setActive + setProcessing.
   * Debe llamarse después de initializeInstance y antes de processBlock.
   */
  activateProcessing(
    pluginKey: string,
    instanceId: string,
    sampleRate: number,
    maxBlockSize: number
  ): Promise<Vst3ActivateProcessingResult> {
    return invoke<Vst3ActivateProcessingResult>('vst3_activate_processing', {
      pluginKey,
      instanceId,
      sampleRate,
      maxBlockSize,
    });
  },

  /**
   * Procesa un bloque planar L/R (Float32) vía IAudioProcessor::process.
   * Fase de prueba / IPC; el worklet RT vendrá después.
   */
  processBlock(
    pluginKey: string,
    instanceId: string,
    inputL: number[],
    inputR: number[]
  ): Promise<Vst3ProcessBlockResult> {
    return invoke<Vst3ProcessBlockResult>('vst3_process_block', {
      pluginKey,
      instanceId,
      inputL,
      inputR,
    });
  },
};