// src/features/preferences/components/panels/PlaceholderPanel.tsx

import { memo } from 'react';
import type { PreferenceCategory } from '@domain/models/PreferenceCategory';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface PlaceholderPanelProps {
  /** Categoría cuyo panel aún no está implementado */
  category: PreferenceCategory;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * PlaceholderPanel
 * ----------------
 * Panel de fallback para categorías marcadas como `placeholder: true`
 * en el catálogo, o para categorías cuyo panel real aún no existe.
 *
 * Muestra:
 *   • Nombre de la categoría
 *   • Descripción (si tiene)
 *   • Mensaje "Coming soon"
 *   • ID técnico (útil durante desarrollo)
 */
function PlaceholderPanelBase({ category }: PlaceholderPanelProps) {
  return (
    <div className="prefs-panel prefs-panel--placeholder">
      <div className="prefs-panel__header">
        <h2 className="prefs-panel__title">{category.label}</h2>
        {category.description && (
          <p className="prefs-panel__subtitle">{category.description}</p>
        )}
      </div>

      <div className="prefs-panel__body">
        <div className="prefs-placeholder">
          <span className="prefs-placeholder__icon">🚧</span>
          <div className="prefs-placeholder__text">
            <div className="prefs-placeholder__main">Coming soon</div>
            <div className="prefs-placeholder__hint">
              Este panel aún no está implementado.
            </div>
            <code className="prefs-placeholder__id">{category.id}</code>
          </div>
        </div>
      </div>
    </div>
  );
}

export const PlaceholderPanel = memo(PlaceholderPanelBase);