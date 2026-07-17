// src/services/plugins/vst3Bridge.ts
//
// Bridge TypeScript → comandos Rust VST3.
// Wrapper tipado sobre invoke() de Tauri.

import { invoke } from '@tauri-apps/api/core';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface Vst3ClassInfo {
  cid:         string;
  cardinality: number;
  category:    string;
  name:        string;
}

export interface Vst3LoadResult {
  success:     boolean;
  message:     string;
  bundle_path: string;
  dll_path:    string | null;
  plugin_key:  string | null;
  factory_ptr: string | null;
  classes:     Vst3ClassInfo[];
}

export interface Vst3InstanceInfo {
  instance_id:     string;
  class_cid:       string;
  component_ptr:   string;
  initialized:     boolean;
  plugin_base_ptr: string;
  has_editor:      boolean;
}

export interface Vst3CreateResult {
  success:       boolean;
  message:       string;
  instance_id:   string | null;
  component_ptr: string | null;
  class_cid:     string;
}

export interface Vst3InitResult {
  success:          boolean;
  message:          string;
  hresult:          number;
  plugin_base_ptr:  string | null;
  host_context_ptr: string | null;
}

export interface Vst3OpenEditorResult {
  success:        boolean;
  message:        string;
  hwnd:           string | null;
  width:          number;
  height:         number;
  controller_ptr: string | null;
  view_ptr:       string | null;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

/**
 * Categoría oficial del VST3 SDK para clases de audio.
 * Algunos plugins la reportan con sub-clasificación (ej. "|Fx|Pitch Shift").
 */
const AUDIO_MODULE_CATEGORY_PREFIX = 'Audio Module Class';

// ═══════════════════════════════════════════════════════════════
// 🎯 API DE BAJO NIVEL — 1:1 con comandos Rust
// ═══════════════════════════════════════════════════════════════

export const vst3Bridge = {

  /** Carga un plugin VST3 en el registry del backend. */
  async loadPlugin(bundlePath: string): Promise<Vst3LoadResult> {
    return invoke<Vst3LoadResult>('vst3_load_plugin', { bundlePath });
  },

  /** Descarga un plugin del registry (libera DLL + instancias). */
  async unloadPlugin(pluginKey: string): Promise<boolean> {
    return invoke<boolean>('vst3_unload_plugin', { pluginKey });
  },

  /** Lista los plugin_keys actualmente cargados. */
  async listLoaded(): Promise<string[]> {
    return invoke<string[]>('vst3_list_loaded');
  },

  /** Crea una instancia de una clase del plugin. */
  async createInstance(
    pluginKey: string,
    classCid:  string,
  ): Promise<Vst3CreateResult> {
    return invoke<Vst3CreateResult>('vst3_create_instance', {
      pluginKey,
      classCid,
    });
  },

  /** Inicializa una instancia con el host context. */
  async initializeInstance(
    pluginKey:  string,
    instanceId: string,
  ): Promise<Vst3InitResult> {
    return invoke<Vst3InitResult>('vst3_initialize_instance', {
      pluginKey,
      instanceId,
    });
  },

  /** Termina una instancia inicializada. */
  async terminateInstance(
    pluginKey:  string,
    instanceId: string,
  ): Promise<boolean> {
    return invoke<boolean>('vst3_terminate_instance', {
      pluginKey,
      instanceId,
    });
  },

  /** Libera una instancia completamente. */
  async releaseInstance(
    pluginKey:  string,
    instanceId: string,
  ): Promise<boolean> {
    return invoke<boolean>('vst3_release_instance', {
      pluginKey,
      instanceId,
    });
  },

  /** Lista instancias vivas de un plugin cargado. */
  async listInstances(pluginKey: string): Promise<Vst3InstanceInfo[]> {
    return invoke<Vst3InstanceInfo[]>('vst3_list_instances', { pluginKey });
  },

  /** Abre la ventana nativa del editor del plugin. */
  async openEditor(
    pluginKey:  string,
    instanceId: string,
  ): Promise<Vst3OpenEditorResult> {
    return invoke<Vst3OpenEditorResult>('vst3_open_editor', {
      pluginKey,
      instanceId,
    });
  },

  /** Cierra la ventana nativa del editor. */
  async closeEditor(
    pluginKey:  string,
    instanceId: string,
  ): Promise<boolean> {
    return invoke<boolean>('vst3_close_editor', {
      pluginKey,
      instanceId,
    });
  },

  // ═══════════════════════════════════════════════════════════
  // 🎯 HELPERS DE ALTO NIVEL
  // ═══════════════════════════════════════════════════════════

  /**
   * Carga un plugin y garantiza que devuelve sus clases.
   *
   * ⚠️  WORKAROUND del backend actual: si el plugin YA estaba cargado,
   * `vst3_load_plugin` devuelve `classes: []` y `factory_ptr: null`.
   * Detectamos ese caso y forzamos unload+reload para obtener el
   * snapshot completo. Cuando el backend se arregle (devolver el
   * snapshot completo en cache-hit), este workaround se puede quitar
   * sin cambiar la API.
   */
  async loadPluginEnsuringClasses(
    bundlePath: string,
  ): Promise<Vst3LoadResult> {
    let load = await vst3Bridge.loadPlugin(bundlePath);
    if (!load.success || !load.plugin_key) {
      throw new Error(`Load falló para "${bundlePath}": ${load.message}`);
    }

    if (load.classes.length > 0) return load;

    console.warn(
      `[vst3Bridge] "${bundlePath}" devolvió 0 clases ` +
      `(probablemente ya cargado en el registry). Forzando reload…`
    );
    await vst3Bridge.unloadPlugin(load.plugin_key);
    load = await vst3Bridge.loadPlugin(bundlePath);
    if (!load.success || !load.plugin_key) {
      throw new Error(`Reload falló para "${bundlePath}": ${load.message}`);
    }
    if (load.classes.length === 0) {
      throw new Error(
        `El plugin "${bundlePath}" no expone clases ni tras reload — ` +
        `bundle roto o factory sin countClasses()`
      );
    }
    return load;
  },

  /**
   * Busca la primera clase Audio Module Class en el resultado del load.
   * Acepta tanto `"Audio Module Class"` (match exacto) como
   * `"Audio Module Class|Fx|…"` (con sub-clasificación del SDK).
   */
  findAudioModuleClass(load: Vst3LoadResult): Vst3ClassInfo | null {
    return (
      load.classes.find(c => c.category === AUDIO_MODULE_CATEGORY_PREFIX) ??
      load.classes.find(c =>
        c.category.startsWith(AUDIO_MODULE_CATEGORY_PREFIX)
      ) ??
      null
    );
  },

  /**
   * Carga, instancia, inicializa y abre el editor de un plugin en un solo paso.
   *
   * Ante cualquier fallo, hace cleanup automático de los recursos ya
   * adquiridos para no dejar leaks en el backend.
   */
  async loadAndInit(bundlePath: string): Promise<{
    pluginKey:  string;
    instanceId: string;
    width:      number;
    height:     number;
  }> {
    // 1. Load con garantía de classes
    const load = await vst3Bridge.loadPluginEnsuringClasses(bundlePath);
    const pluginKey = load.plugin_key!;

    // 2. Buscar Audio Module Class
    const audioClass = vst3Bridge.findAudioModuleClass(load);
    if (!audioClass) {
      await vst3Bridge.unloadPlugin(pluginKey);
      const classInfo = load.classes
        .map(c => `"${c.name}" [${c.category}]`)
        .join(', ');
      throw new Error(
        `No se encontró Audio Module Class en "${bundlePath}". ` +
        `Clases disponibles: ${classInfo}`
      );
    }

    // 3. Create instance
    const create = await vst3Bridge.createInstance(pluginKey, audioClass.cid);
    if (!create.success || !create.instance_id) {
      await vst3Bridge.unloadPlugin(pluginKey);
      throw new Error(`createInstance falló: ${create.message}`);
    }
    const instanceId = create.instance_id;

    // 4. Initialize
    const init = await vst3Bridge.initializeInstance(pluginKey, instanceId);
    if (!init.success) {
      await vst3Bridge.releaseInstance(pluginKey, instanceId);
      await vst3Bridge.unloadPlugin(pluginKey);
      throw new Error(`initialize falló: ${init.message}`);
    }

    // 5. Open editor
    const editor = await vst3Bridge.openEditor(pluginKey, instanceId);
    if (!editor.success) {
      await vst3Bridge.terminateInstance(pluginKey, instanceId);
      await vst3Bridge.releaseInstance(pluginKey, instanceId);
      await vst3Bridge.unloadPlugin(pluginKey);
      throw new Error(`openEditor falló: ${editor.message}`);
    }

    return {
      pluginKey,
      instanceId,
      width:  editor.width,
      height: editor.height,
    };
  },

  /**
   * Cierra editor, termina y descarga un plugin completamente.
   * Ignora errores individuales para garantizar cleanup best-effort.
   */
  async closeAndUnload(
    pluginKey:  string,
    instanceId: string,
  ): Promise<void> {
    const step = async (label: string, fn: () => Promise<unknown>) => {
      try { await fn(); }
      catch (e) {
        console.warn(`[vst3Bridge.closeAndUnload] ${label} falló:`, e);
      }
    };

    await step('closeEditor',       () => vst3Bridge.closeEditor(pluginKey, instanceId));
    await step('terminateInstance', () => vst3Bridge.terminateInstance(pluginKey, instanceId));
    await step('releaseInstance',   () => vst3Bridge.releaseInstance(pluginKey, instanceId));
    await step('unloadPlugin',      () => vst3Bridge.unloadPlugin(pluginKey));
  },
};