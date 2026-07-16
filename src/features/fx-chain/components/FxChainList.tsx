// src/features/fx-chain/components/FxChainList.tsx

import { memo, useCallback } from 'react';
import { useAppDispatch } from '@state/store';
import {
  togglePluginEnabled,
  removePluginFromChain,
} from '@state/slices/fxChains/fxChainsSlice';
import { openFxBrowser } from '@state/slices/ui/uiSlice';
import type { FxPluginInstance } from '@domain/models/FxPluginInstance';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface FxChainListProps {
  /** ID del owner (trackId) — necesario para dispatch */
  ownerId: string;
  /** Lista ordenada de instancias de plugins */
  plugins: readonly FxPluginInstance[];
  /** ID de la instancia seleccionada (null = ninguna) */
  selectedInstanceId: string | null;
  /** Callback cuando el usuario selecciona una instancia */
  onSelect: (instanceId: string) => void;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * FxChainList
 * -----------
 * Lista lateral izquierda de la ventana FX Chain.
 *
 * Muestra los plugins añadidos con:
 *   ☑/☐ toggle bypass individual
 *   Nombre del plugin
 *   Click → seleccionar (muestra UI a la derecha)
 *
 * Abajo: botones [Add] [Remove]
 */
function FxChainListBase({
  ownerId,
  plugins,
  selectedInstanceId,
  onSelect,
}: FxChainListProps) {
  const dispatch = useAppDispatch();

  // ─── Handlers ───────────────────────────────────────────────

  const handleToggleEnabled = useCallback(
    (e: React.MouseEvent, instanceId: string) => {
      e.stopPropagation();
      dispatch(togglePluginEnabled({ ownerId, instanceId }));
    },
    [dispatch, ownerId]
  );

  const handleAdd = useCallback(() => {
    dispatch(openFxBrowser(ownerId));
  }, [dispatch, ownerId]);

  const handleRemove = useCallback(() => {
    if (!selectedInstanceId) return;
    dispatch(removePluginFromChain({ ownerId, instanceId: selectedInstanceId }));
  }, [dispatch, ownerId, selectedInstanceId]);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <div className="fxchain-list">
      <div className="fxchain-list__items" role="listbox" aria-label="Plugin chain">
        {plugins.length === 0 && (
          <div className="fxchain-list__empty">
            No plugins added
          </div>
        )}

        {plugins.map((inst) => {
          const isSelected = inst.id === selectedInstanceId;
          return (
            <div
              key={inst.id}
              className={`fxchain-list__item ${isSelected ? 'is-selected' : ''} ${!inst.enabled ? 'is-bypassed' : ''}`}
              onClick={() => onSelect(inst.id)}
              role="option"
              aria-selected={isSelected}
              title={`${inst.displayName}${!inst.enabled ? ' (bypassed)' : ''}`}
            >
              <button
                type="button"
                className={`fxchain-list__checkbox ${inst.enabled ? 'is-checked' : ''}`}
                onClick={(e) => handleToggleEnabled(e, inst.id)}
                aria-label={inst.enabled ? `Bypass ${inst.displayName}` : `Enable ${inst.displayName}`}
                title={inst.enabled ? 'Click to bypass' : 'Click to enable'}
              >
                {inst.enabled ? '☑' : '☐'}
              </button>
              <span className="fxchain-list__name">{inst.displayName}</span>
            </div>
          );
        })}
      </div>

      <div className="fxchain-list__actions">
        <button
          type="button"
          className="fxchain-list__btn"
          onClick={handleAdd}
          title="Add plugin from browser"
        >
          Add
        </button>
        <button
          type="button"
          className="fxchain-list__btn"
          onClick={handleRemove}
          disabled={!selectedInstanceId}
          title={selectedInstanceId ? 'Remove selected plugin' : 'Select a plugin first'}
        >
          Remove
        </button>
      </div>
    </div>
  );
}

export const FxChainList = memo(FxChainListBase);