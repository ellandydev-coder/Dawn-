// src/features/fx-browser/components/FxBrowserSidebar.tsx

import { memo, useMemo } from 'react';
import { useSelector } from 'react-redux';
import {
  FX_PLUGIN_CATEGORIES,
  FX_PLUGIN_CATEGORY_LABELS,
  type FxPluginCategory,
} from '@domain/enums/FxPluginCategory';
import { FxCatalog } from '@services/fx-catalog/FxCatalog';
import type { RootState } from '@state/store';
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

const TOP_ENTRIES: ReadonlyArray<{
  key: CategoryFilter;
  label: string;
  hint?: string;
}> = [
  { key: 'all', label: 'All Plugins' },
  { key: 'recent', label: 'Recently used', hint: '(próximamente)' },
];

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

function FxBrowserSidebarBase({
  selectedCategory,
  onSelectCategory,
}: FxBrowserSidebarProps) {
  // ⚠️ Reactividad: observamos el scan para recalcular counts cuando
  // se registran plugins nuevos.
  const scanFoundIds = useSelector(
    (state: RootState) => state.pluginScan.foundIds
  );

  const categoryCounts = useMemo(() => {
    void scanFoundIds; // trigger de reactividad
    const counts: Record<string, number> = {};
    for (const cat of FX_PLUGIN_CATEGORIES) {
      counts[cat] = FxCatalog.getByCategory(cat).length;
    }
    return counts;
  }, [scanFoundIds]);

  const totalCount = useMemo(() => {
    void scanFoundIds;
    return FxCatalog.getAll().length;
  }, [scanFoundIds]);

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
            const isDisabled = entry.key === 'recent';

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