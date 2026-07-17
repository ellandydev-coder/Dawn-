// src/features/fx-browser/hooks/useFxBrowser.ts

import { useCallback, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { FxCatalog } from '@services/fx-catalog/FxCatalog';
import type { RootState } from '@state/store';
import type { FxPluginInfo } from '@domain/models/FxPluginInfo';
import type { FxPluginCategory } from '@domain/enums/FxPluginCategory';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export type CategoryFilter = 'all' | 'recent' | FxPluginCategory;

export interface UseFxBrowserResult {
  filterText: string;
  setFilterText: (text: string) => void;
  clearFilter: () => void;

  selectedCategory: CategoryFilter;
  setSelectedCategory: (cat: CategoryFilter) => void;

  selectedPluginId: string | null;
  setSelectedPluginId: (id: string | null) => void;

  filteredPlugins: readonly FxPluginInfo[];

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
 * ⚠️ REACTIVIDAD:
 * El `FxCatalog` es un singleton mutable fuera de React. Para que
 * los cambios (nuevos plugins registrados tras un scan) se reflejen
 * en la UI, este hook OBSERVA `pluginScan.foundIds` desde Redux.
 * Cada vez que ese array cambia (después de un scan), el useMemo
 * se recalcula leyendo el estado actualizado del FxCatalog.
 */
export function useFxBrowser(): UseFxBrowserResult {
  const [filterText, setFilterTextInternal] = useState('');
  const [selectedCategory, setSelectedCategoryInternal] =
    useState<CategoryFilter>('all');
  const [selectedPluginId, setSelectedPluginIdInternal] = useState<
    string | null
  >(null);

  // ─── Suscripción reactiva al scan ────────────────────────────
  // Cuando termina un escaneo, `foundIds` cambia y forzamos re-render.
  const scanFoundIds = useSelector(
    (state: RootState) => state.pluginScan.foundIds
  );

  // ─── Setters estables ───────────────────────────────────────

  const setFilterText = useCallback((text: string) => {
    setFilterTextInternal(text);
    setSelectedPluginIdInternal(null);
  }, []);

  const clearFilter = useCallback(() => {
    setFilterTextInternal('');
    setSelectedPluginIdInternal(null);
  }, []);

  const setSelectedCategory = useCallback((cat: CategoryFilter) => {
    setSelectedCategoryInternal(cat);
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
    // El `scanFoundIds` en las deps fuerza recomputar cuando llegan VST3 nuevos
    void scanFoundIds;

    let base: readonly FxPluginInfo[];

    if (selectedCategory === 'all') {
      base = FxCatalog.getAll();
    } else if (selectedCategory === 'recent') {
      base = [];
    } else {
      base = FxCatalog.getByCategory(selectedCategory);
    }

    const trimmed = filterText.trim().toLowerCase();
    if (trimmed.length === 0) return base;

    return base.filter((p) => {
      const haystack = `${p.name} ${p.vendor} ${p.description}`.toLowerCase();
      return haystack.includes(trimmed);
    });
  }, [selectedCategory, filterText, scanFoundIds]);

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