// src/features/fx-browser/components/FxBrowserList.tsx

import { memo, useCallback } from 'react';
import { FX_PLUGIN_FORMAT_LABELS } from '@domain/enums/FxPluginFormat';
import type { FxPluginInfo } from '@domain/models/FxPluginInfo';

// ═══════════════════════════════════════════════════════════════
// 🎯 PROPS
// ═══════════════════════════════════════════════════════════════

export interface FxBrowserListProps {
  plugins: readonly FxPluginInfo[];
  selectedPluginId: string | null;
  onSelectPlugin: (id: string | null) => void;
  onDoubleClickPlugin: (id: string) => void;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * FxBrowserList
 * -------------
 * Panel central del FX Browser: muestra la lista filtrada de plugins.
 *
 * Cada fila muestra: [formato] Nombre (Vendor)
 * Click simple  → seleccionar
 * Doble-click   → seleccionar + añadir (via callback del padre)
 */
function FxBrowserListBase({
  plugins,
  selectedPluginId,
  onSelectPlugin,
  onDoubleClickPlugin,
}: FxBrowserListProps) {
  const handleRowClick = useCallback(
    (id: string) => {
      onSelectPlugin(id);
    },
    [onSelectPlugin]
  );

  const handleRowDoubleClick = useCallback(
    (id: string) => {
      onDoubleClickPlugin(id);
    },
    [onDoubleClickPlugin]
  );

  // ─── Estado vacío ─────────────────────────────────────────
  if (plugins.length === 0) {
    return (
      <div className="fx-browser-list is-empty" role="status">
        <div className="fx-browser-list-empty">
          <div className="fx-browser-list-empty-icon" aria-hidden="true">
            🔍
          </div>
          <div className="fx-browser-list-empty-text">
            No se encontraron plugins
          </div>
          <div className="fx-browser-list-empty-hint">
            Prueba con otra categoría o cambia el filtro
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fx-browser-list"
      role="listbox"
      aria-label="Plugins disponibles"
    >
      {plugins.map((plugin) => {
        const isSelected = plugin.id === selectedPluginId;
        const isUnavailable = !plugin.available;

        const className = [
          'fx-browser-list-row',
          isSelected && 'is-selected',
          isUnavailable && 'is-unavailable',
        ]
          .filter(Boolean)
          .join(' ');

        return (
          <div
            key={plugin.id}
            className={className}
            onClick={() => handleRowClick(plugin.id)}
            onDoubleClick={() => handleRowDoubleClick(plugin.id)}
            role="option"
            aria-selected={isSelected}
            aria-disabled={isUnavailable}
            title={
              isUnavailable
                ? `${plugin.name} — no disponible todavía`
                : plugin.description || plugin.name
            }
            tabIndex={0}
          >
            <span className="fx-browser-list-row-format">
              {FX_PLUGIN_FORMAT_LABELS[plugin.format]}
            </span>
            <span className="fx-browser-list-row-name">{plugin.name}</span>
            <span className="fx-browser-list-row-vendor">
              ({plugin.vendor})
            </span>
            {isUnavailable && (
              <span
                className="fx-browser-list-row-badge"
                aria-label="No disponible"
              >
                soon
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

export const FxBrowserList = memo(FxBrowserListBase);