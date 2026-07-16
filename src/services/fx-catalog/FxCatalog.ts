// src/services/fx-catalog/FxCatalog.ts

import type { FxPluginInfo } from '@domain/models/FxPluginInfo';
import type { FxPluginCategory } from '@domain/enums/FxPluginCategory';
import type { FxPluginFormat } from '@domain/enums/FxPluginFormat';
import { BUILT_IN_FX_CATALOG } from './builtInFxCatalog';

// ═══════════════════════════════════════════════════════════════
// 🎯 FxCatalog
// ═══════════════════════════════════════════════════════════════

/**
 * Catálogo central de plugins FX disponibles en DAWN.
 *
 * Fuentes actuales:
 *   • Built-in (siempre presentes)
 *
 * Fuentes futuras:
 *   • WASM plugins de terceros (cargados dinámicamente)
 *   • VST3 escaneados vía Tauri IPC
 *   • JSFX scripts (estilo REAPER)
 *
 * Este servicio es un singleton en memoria. La persistencia
 * de "recently used" / "favorites" vive en un slice aparte
 * cuando lo necesitemos.
 */
class FxCatalogService {
  private readonly _plugins = new Map<string, FxPluginInfo>();

  constructor() {
    // Cargar built-in al arranque
    for (const plugin of BUILT_IN_FX_CATALOG) {
      this._plugins.set(plugin.id, plugin);
    }
  }

  /** Devuelve todos los plugins del catálogo */
  public getAll(): readonly FxPluginInfo[] {
    return Array.from(this._plugins.values());
  }

  /** Busca un plugin por id */
  public getById(id: string): FxPluginInfo | null {
    return this._plugins.get(id) ?? null;
  }

  /** Filtra por categoría */
  public getByCategory(
    category: FxPluginCategory
  ): readonly FxPluginInfo[] {
    return this.getAll().filter((p) => p.category === category);
  }

  /** Filtra por formato */
  public getByFormat(format: FxPluginFormat): readonly FxPluginInfo[] {
    return this.getAll().filter((p) => p.format === format);
  }

  /**
   * Búsqueda textual case-insensitive en nombre + vendor + descripción.
   * Devuelve todos si el filtro está vacío.
   */
  public search(filter: string): readonly FxPluginInfo[] {
    const trimmed = filter.trim().toLowerCase();
    if (trimmed.length === 0) return this.getAll();

    return this.getAll().filter((p) => {
      const haystack = `${p.name} ${p.vendor} ${p.description}`.toLowerCase();
      return haystack.includes(trimmed);
    });
  }

  /**
   * Registra un plugin dinámicamente.
   * Útil para plugins de terceros cargados en runtime.
   * Si el id ya existe, se sobrescribe (con warning en dev).
   */
  public register(plugin: FxPluginInfo): void {
    if (this._plugins.has(plugin.id) && import.meta.env?.DEV) {
      console.warn(
        `[FxCatalog] Plugin '${plugin.id}' ya existe. Sobrescribiendo.`
      );
    }
    this._plugins.set(plugin.id, plugin);
  }

  /** Elimina un plugin del catálogo (para hot-reload o unregister) */
  public unregister(id: string): boolean {
    return this._plugins.delete(id);
  }

  /** Total de plugins registrados */
  public get size(): number {
    return this._plugins.size;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 SINGLETON
// ═══════════════════════════════════════════════════════════════

export const FxCatalog = new FxCatalogService();