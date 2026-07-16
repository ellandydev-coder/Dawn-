// src/features/preferences/components/PreferencesSidebar.tsx

import { memo, useMemo, useCallback } from 'react';
import { preferencesRegistry } from '@features/preferences/registry';
import type { PreferencePanelEntry } from '@features/preferences/registry';
import { buildTree } from '@shared/registry/registry.utils';

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
 * Fuente de datos:
 *   • `preferencesRegistry.getAll()` — todas las entries descubiertas
 *     por el bootstrap (paneles reales + seed).
 *   • `buildTree()` construye el árbol raíz → children basándose
 *     en el campo `parentId` de cada entry.
 *
 * La categoría seleccionada se resalta en azul. Todas las
 * categorías (raíz agrupadoras, raíz con panel, sub-categorías)
 * son clicables por igual.
 */
function PreferencesSidebarBase({
  selectedId,
  onSelect,
}: PreferencesSidebarProps) {
  // El árbol se recalcula solo si cambia el contenido del registry.
  // Como el registry es inmutable después del bootstrap, en la práctica
  // se calcula 1 sola vez (al primer render).
  const tree = useMemo(
    () => buildTree<PreferencePanelEntry>(preferencesRegistry.getAll()),
    []
  );

  return (
    <nav className="prefs-sidebar" aria-label="Preferences categories">
      <ul className="prefs-sidebar__list" role="tree">
        {tree.map(({ entry, children }) => (
          <PreferenceNode
            key={entry.id}
            entry={entry}
            children={children}
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
// 🌿 PREFERENCE NODE (raíz + hijos)
// ═══════════════════════════════════════════════════════════════

interface PreferenceNodeProps {
  entry: PreferencePanelEntry;
  children: readonly PreferencePanelEntry[];
  selectedId: string;
  onSelect: (id: string) => void;
}

const PreferenceNode = memo(function PreferenceNode({
  entry,
  children,
  selectedId,
  onSelect,
}: PreferenceNodeProps) {
  const isSelected = entry.id === selectedId;

  const handleClick = useCallback(() => {
    onSelect(entry.id);
  }, [entry.id, onSelect]);

  return (
    <li className="prefs-sidebar__node" role="none">
      <button
        type="button"
        className={`prefs-sidebar__item prefs-sidebar__item--root ${isSelected ? 'is-selected' : ''}`}
        onClick={handleClick}
        role="treeitem"
        aria-selected={isSelected}
        title={entry.description ?? entry.label}
      >
        {entry.label}
      </button>

      {children.length > 0 && (
        <ul className="prefs-sidebar__children" role="group">
          {children.map((child) => {
            const childSelected = child.id === selectedId;
            return (
              <li key={child.id} role="none">
                <button
                  type="button"
                  className={`prefs-sidebar__item prefs-sidebar__item--child ${childSelected ? 'is-selected' : ''}`}
                  onClick={() => onSelect(child.id)}
                  role="treeitem"
                  aria-selected={childSelected}
                  title={child.description ?? child.label}
                >
                  {child.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </li>
  );
});