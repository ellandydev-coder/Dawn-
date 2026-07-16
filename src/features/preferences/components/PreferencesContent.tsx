// src/features/preferences/components/PreferencesContent.tsx

import { memo, useMemo } from 'react';
import { preferencesRegistry } from '@features/preferences/registry';
import type { PreferencePanelEntry } from '@features/preferences/registry';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface PreferencesContentProps {
  /** ID de la categoría actualmente seleccionada */
  selectedId: string;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

/**
 * PreferencesContent
 * ------------------
 * Panel derecho de Preferences.
 *
 * Lee la entry del registry por `selectedId` y decide qué renderizar:
 *   • Si la entry tiene `component` → lo renderiza pasando panelId
 *   • Si NO tiene `component` (agrupador o placeholder) → muestra
 *     placeholder auto-generado con label + description + hint
 *
 * ZERO switch cases, zero conocimiento hardcodeado de qué paneles
 * existen. El router es implícito: si la entry está en el registry
 * y tiene component, se muestra.
 */
function PreferencesContentBase({ selectedId }: PreferencesContentProps) {
  const entry = useMemo(
    () => preferencesRegistry.getById(selectedId),
    [selectedId]
  );

  // ─── Entry no encontrada (edge case) ────────────────────────

  if (!entry) {
    return (
      <div className="prefs-content prefs-content--empty">
        <div className="prefs-empty">
          <span className="prefs-empty__icon">❌</span>
          <div className="prefs-empty__text">
            Categoría no encontrada
            <code className="prefs-empty__id">{selectedId}</code>
          </div>
        </div>
      </div>
    );
  }

  // ─── Entry sin component → placeholder auto-generado ────────

  if (!entry.component) {
    return (
      <div className="prefs-content">
        <PlaceholderPanel entry={entry} />
      </div>
    );
  }

  // ─── Entry con component → renderizar el panel real ─────────

  const PanelComponent = entry.component;
  return (
    <div className="prefs-content">
      <PanelComponent panelId={entry.id} />
    </div>
  );
}

export const PreferencesContent = memo(PreferencesContentBase);

// ═══════════════════════════════════════════════════════════════
// 🏗️ PLACEHOLDER PANEL (inline)
// ═══════════════════════════════════════════════════════════════

/**
 * PlaceholderPanel
 * ----------------
 * Fallback interno para categorías sin `component` propio.
 *
 * Antes vivía en `panels/PlaceholderPanel.tsx` como componente
 * separado. Con el auto-registry ya no hace falta exportarlo:
 * es un detalle de implementación del router.
 */
interface PlaceholderPanelProps {
  entry: PreferencePanelEntry;
}

function PlaceholderPanel({ entry }: PlaceholderPanelProps) {
  const isGrouper = !entry.parentId;
  const hint = isGrouper
    ? 'Esta es una categoría agrupadora. Selecciona una sub-categoría en el sidebar.'
    : 'Este panel aún no está implementado.';

  return (
    <div className="prefs-panel prefs-panel--placeholder">
      <div className="prefs-panel__header">
        <h2 className="prefs-panel__title">{entry.label}</h2>
        {entry.description && (
          <p className="prefs-panel__subtitle">{entry.description}</p>
        )}
      </div>

      <div className="prefs-panel__body">
        <div className="prefs-placeholder">
          <span className="prefs-placeholder__icon">
            {isGrouper ? '📁' : '🚧'}
          </span>
          <div className="prefs-placeholder__text">
            <div className="prefs-placeholder__main">
              {isGrouper ? 'Grupo de categorías' : 'Coming soon'}
            </div>
            <div className="prefs-placeholder__hint">{hint}</div>
            <code className="prefs-placeholder__id">{entry.id}</code>
          </div>
        </div>
      </div>
    </div>
  );
}