// src/features/fx-browser/components/FxBrowserSidebar.tsx

import { memo, useMemo } from 'react';
import {
  FX_PLUGIN_CATEGORIES,
  FX_PLUGIN_CATEGORY_LABELS,
  type FxPluginCategory,
} from '@domain/enums/FxPluginCategory';
import { FxCatalog } from '@services/fx-catalog/FxCatalog';
import type { CategoryFilter } from '../hooks/useFxBrowser';

// ═══════════════════════════════════════════════════════════════
// 🎯 PROPS
// ═══════════════════════════════════════════════════════════════

export interface FxBrowserSidebarProps {
  selectedCategory: CategoryFilter;
  onSelectCategory: (cat: CategoryFilter) => void;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

/** Etiquetas de los grupos superiores (fuera de "Categories") */
const TOP_ENTRIES: ReadonlyArray<{
  key: CategoryFilter;
  label: string;
  hint?: string;
}> = [
  { key: 'all',    label: 'All Plugins' },
  { key: 'recent', label: 'Recently used', hint: '(próximamente)' },
];

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * FxBrowserSidebar
 * ----------------
 * Panel izquierdo del FX Browser con dos secciones:
 *
 *   1. Grupos superiores (All / Recent)
 *   2. Categorías (EQ, Dynamics, Reverb, ...)
 *
 * Cada categoría muestra su nombre + count de plugins.
 * El click cambia el filtro activo en el hook padre.
 */
function FxBrowserSidebarBase({
  selectedCategory,
  onSelectCategory,
}: FxBrowserSidebarProps) {
  // Conteo de plugins por categoría (una sola vez por render)
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of FX_PLUGIN_CATEGORIES) {
      counts[cat] = FxCatalog.getByCategory(cat).length;
    }
    return counts;
  }, []);

  const totalCount = useMemo(() => FxCatalog.getAll().length, []);

  return (
    <aside
      className="fx-browser-sidebar"
      role="navigation"
      aria-label="Categorías de plugins"
    >
      {/* ─── Grupo superior ─────────────────────────────── */}
      <div className="fx-browser-sidebar-section">
        <div className="fx-browser-sidebar-section-title">All Plugins</div>
        <ul className="fx-browser-sidebar-list" role="listbox">
          {TOP_ENTRIES.map((entry) => {
            const isSelected = selectedCategory === entry.key;
            const isDisabled = entry.key === 'recent'; // futuro

            return (
              <li key={entry.key}>
                <button
                  type="button"
                  className={[
                    'fx-browser-sidebar-item',
                    isSelected && 'is-selected',
                    isDisabled && 'is-disabled',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => !isDisabled && onSelectCategory(entry.key)}
                  disabled={isDisabled}
                  aria-selected={isSelected}
                  role="option"
                  title={entry.hint ?? entry.label}
                >
                  <span className="fx-browser-sidebar-item-label">
                    {entry.label}
                  </span>
                  {entry.key === 'all' && (
                    <span className="fx-browser-sidebar-item-count">
                      {totalCount}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* ─── Categorías ─────────────────────────────────── */}
      <div className="fx-browser-sidebar-section">
        <div className="fx-browser-sidebar-section-title">Categories</div>
        <ul className="fx-browser-sidebar-list" role="listbox">
          {FX_PLUGIN_CATEGORIES.map((cat: FxPluginCategory) => {
            const isSelected = selectedCategory === cat;
            const count = categoryCounts[cat] ?? 0;
            const isEmpty = count === 0;

            return (
              <li key={cat}>
                <button
                  type="button"
                  className={[
                    'fx-browser-sidebar-item',
                    isSelected && 'is-selected',
                    isEmpty && 'is-empty',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => onSelectCategory(cat)}
                  aria-selected={isSelected}
                  role="option"
                  title={`${FX_PLUGIN_CATEGORY_LABELS[cat]} (${count})`}
                >
                  <span className="fx-browser-sidebar-item-label">
                    {FX_PLUGIN_CATEGORY_LABELS[cat]}
                  </span>
                  <span className="fx-browser-sidebar-item-count">
                    {count}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}

export const FxBrowserSidebar = memo(FxBrowserSidebarBase);