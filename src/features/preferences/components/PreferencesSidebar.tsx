// src/features/preferences/components/PreferencesSidebar.tsx

import { memo, useMemo, useCallback } from 'react';
import { buildCategoryTree } from '../data/preferencesCatalog';
import type { PreferenceCategoryNode } from '@domain/models/PreferenceCategory';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface PreferencesSidebarProps {
  /** ID de la categoría actualmente seleccionada */
  selectedId: string;
  /** Callback al hacer clic en una categoría */
  onSelect: (id: string) => void;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * PreferencesSidebar
 * ------------------
 * Sidebar izquierdo con el árbol jerárquico de categorías.
 *
 * Estructura visual:
 *   Categoría raíz
 *     ├─ Sub-categoría 1
 *     ├─ Sub-categoría 2
 *   Otra categoría raíz
 *     ├─ Sub-categoría 3
 *
 * La categoría seleccionada se resalta en azul.
 * Todas las categorías (raíz y sub) son clicables.
 */
function PreferencesSidebarBase({
  selectedId,
  onSelect,
}: PreferencesSidebarProps) {
  // El árbol se construye una sola vez (el catálogo es estático).
  const tree = useMemo(() => buildCategoryTree(), []);

  return (
    <nav className="prefs-sidebar" aria-label="Preferences categories">
      <ul className="prefs-sidebar__list" role="tree">
        {tree.map((node) => (
          <PreferenceNode
            key={node.category.id}
            node={node}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        ))}
      </ul>
    </nav>
  );
}

export const PreferencesSidebar = memo(PreferencesSidebarBase);

// ═══════════════════════════════════════════════════════════════
// 🌿 PREFERENCE NODE (recursivo pero solo 1 nivel de anidación)
// ═══════════════════════════════════════════════════════════════

interface PreferenceNodeProps {
  node: PreferenceCategoryNode;
  selectedId: string;
  onSelect: (id: string) => void;
}

const PreferenceNode = memo(function PreferenceNode({
  node,
  selectedId,
  onSelect,
}: PreferenceNodeProps) {
  const { category, children } = node;
  const isSelected = category.id === selectedId;

  const handleClick = useCallback(() => {
    onSelect(category.id);
  }, [category.id, onSelect]);

  return (
    <li className="prefs-sidebar__node" role="none">
      <button
        type="button"
        className={`prefs-sidebar__item prefs-sidebar__item--root ${isSelected ? 'is-selected' : ''}`}
        onClick={handleClick}
        role="treeitem"
        aria-selected={isSelected}
        title={category.description ?? category.label}
      >
        {category.label}
      </button>

      {children.length > 0 && (
        <ul className="prefs-sidebar__children" role="group">
          {children.map((child) => {
            const childSelected = child.category.id === selectedId;
            return (
              <li key={child.category.id} role="none">
                <button
                  type="button"
                  className={`prefs-sidebar__item prefs-sidebar__item--child ${childSelected ? 'is-selected' : ''}`}
                  onClick={() => onSelect(child.category.id)}
                  role="treeitem"
                  aria-selected={childSelected}
                  title={child.category.description ?? child.category.label}
                >
                  {child.category.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
});