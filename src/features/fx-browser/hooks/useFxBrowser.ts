// src/features/fx-browser/hooks/useFxBrowser.ts

import { useCallback, useMemo, useState } from 'react';
import { FxCatalog } from '@services/fx-catalog/FxCatalog';
import type { FxPluginInfo } from '@domain/models/FxPluginInfo';
import type { FxPluginCategory } from '@domain/enums/FxPluginCategory';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/**
 * Filtro de categoría en el sidebar.
 * - 'all'          → mostrar todos los plugins
 * - 'recent'       → mostrar recientemente usados (futuro)
 * - FxPluginCategory → categoría específica ('eq', 'reverb', etc.)
 */
export type CategoryFilter = 'all' | 'recent' | FxPluginCategory;

export interface UseFxBrowserResult {
  /** Texto actual del filtro de búsqueda */
  filterText: string;
  /** Actualiza el filtro de búsqueda */
  setFilterText: (text: string) => void;
  /** Limpia el filtro */
  clearFilter: () => void;

  /** Categoría actualmente seleccionada en el sidebar */
  selectedCategory: CategoryFilter;
  /** Cambia la categoría seleccionada */
  setSelectedCategory: (cat: CategoryFilter) => void;

  /** Plugin actualmente seleccionado en la lista (null = ninguno) */
  selectedPluginId: string | null;
  /** Selecciona un plugin */
  setSelectedPluginId: (id: string | null) => void;

  /** Lista filtrada según categoría + búsqueda */
  filteredPlugins: readonly FxPluginInfo[];

  /** Reset completo (filtros + selección) — útil al cerrar/reabrir */
  reset: () => void;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HOOK
// ═══════════════════════════════════════════════════════════════

/**
 * useFxBrowser
 * ------------
 * Hook que encapsula la lógica de filtrado y selección del FX Browser.
 *
 * Estado interno (NO en Redux — es UI puramente local del modal):
 *   • filtro de texto
 *   • categoría seleccionada
 *   • plugin seleccionado
 */
export function useFxBrowser(): UseFxBrowserResult {
  const [filterText, setFilterTextInternal] = useState('');
  const [selectedCategory, setSelectedCategoryInternal] =
    useState<CategoryFilter>('all');
  const [selectedPluginId, setSelectedPluginIdInternal] = useState<
    string | null
  >(null);

  // ─── Setters estables ───────────────────────────────────────

  const setFilterText = useCallback((text: string) => {
    setFilterTextInternal(text);
    // Al cambiar el filtro, deseleccionamos plugin
    setSelectedPluginIdInternal(null);
  }, []);

  const clearFilter = useCallback(() => {
    setFilterTextInternal('');
    setSelectedPluginIdInternal(null);
  }, []);

  const setSelectedCategory = useCallback((cat: CategoryFilter) => {
    setSelectedCategoryInternal(cat);
    // Al cambiar categoría, deseleccionamos plugin
    setSelectedPluginIdInternal(null);
  }, []);

  const setSelectedPluginId = useCallback((id: string | null) => {
    setSelectedPluginIdInternal(id);
  }, []);

  const reset = useCallback(() => {
    setFilterTextInternal('');
    setSelectedCategoryInternal('all');
    setSelectedPluginIdInternal(null);
  }, []);

  // ─── Lista filtrada ─────────────────────────────────────────

  const filteredPlugins = useMemo<readonly FxPluginInfo[]>(() => {
    // Paso 1: filtrar por categoría
    let base: readonly FxPluginInfo[];

    if (selectedCategory === 'all') {
      base = FxCatalog.getAll();
    } else if (selectedCategory === 'recent') {
      // TODO: cuando implementemos "recently used" en Redux
      base = [];
    } else {
      base = FxCatalog.getByCategory(selectedCategory);
    }

    // Paso 2: filtrar por texto (si hay)
    const trimmed = filterText.trim().toLowerCase();
    if (trimmed.length === 0) return base;

    return base.filter((p) => {
      const haystack = `${p.name} ${p.vendor} ${p.description}`.toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [selectedCategory, filterText]);

  return {
    filterText,
    setFilterText,
    clearFilter,
    selectedCategory,
    setSelectedCategory,
    selectedPluginId,
    setSelectedPluginId,
    filteredPlugins,
    reset,
  };
}