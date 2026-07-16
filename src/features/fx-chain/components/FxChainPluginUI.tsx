// src/features/fx-chain/components/FxChainPluginUI.tsx

import { memo } from 'react';
import type { FxPluginInstance } from '@domain/models/FxPluginInstance';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface FxChainPluginUIProps {
  /** Instancia seleccionada en la lista (null = ninguna) */
  instance: FxPluginInstance | null;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * FxChainPluginUI
 * ---------------
 * Panel derecho de la ventana FX Chain.
 * Muestra la UI del plugin seleccionado.
 *
 * MVP: placeholder con nombre del plugin.
 * Futuro: cada plugin registrará su propio componente React
 * via el PluginRegistry, y aquí haremos dynamic render.
 */
function FxChainPluginUIBase({ instance }: FxChainPluginUIProps) {
  if (!instance) {
    return (
      <div className="fxchain-plugin-ui fxchain-plugin-ui--empty">
        <div className="fxchain-plugin-ui__placeholder">
          <span className="fxchain-plugin-ui__icon">🎛️</span>
          <span>Selecciona un plugin de la lista</span>
        </div>
      </div>
    );
  }

  return (
    <div className="fxchain-plugin-ui">
      <div className="fxchain-plugin-ui__header">
        <span className="fxchain-plugin-ui__name">{instance.displayName}</span>
        <span
          className={`fxchain-plugin-ui__status ${instance.enabled ? 'is-active' : 'is-bypassed'}`}
        >
          {instance.enabled ? 'Active' : 'Bypassed'}
        </span>
      </div>

      <div className="fxchain-plugin-ui__body">
        <div className="fxchain-plugin-ui__placeholder">
          <span className="fxchain-plugin-ui__icon">🔧</span>
          <span>Plugin UI: {instance.displayName}</span>
          <span className="fxchain-plugin-ui__hint">
            ID: {instance.pluginId}
          </span>
          {Object.keys(instance.params).length > 0 && (
            <div className="fxchain-plugin-ui__params">
              {Object.entries(instance.params).map(([key, val]) => (
                <span key={key} className="fxchain-plugin-ui__param">
                  {key}: {val.toFixed(2)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export const FxChainPluginUI = memo(FxChainPluginUIBase);