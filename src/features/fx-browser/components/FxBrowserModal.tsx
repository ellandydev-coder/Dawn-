// src/features/fx-browser/components/FxBrowserModal.tsx

import { memo, useCallback, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  selectFxBrowserTrackId,
  closeFxBrowser,
  openFxChainWindow,
} from '@state/slices/ui/uiSlice';
import { addPluginToChain } from '@state/slices/fxChains/fxChainsSlice';
import { Modal } from '@shared/components/Modal';
import { FxCatalog } from '@services/fx-catalog/FxCatalog';
import type { FxPluginInfo } from '@domain/models/FxPluginInfo';
import { useFxBrowser } from '../hooks/useFxBrowser';
import { FxBrowserSidebar } from './FxBrowserSidebar';
import { FxBrowserList } from './FxBrowserList';

import './FxBrowserModal.css';

function isNativePlugin(plugin: FxPluginInfo): boolean {
  return plugin.format === 'vst3' && typeof plugin.sourcePath === 'string';
}

function FxBrowserModalBase() {
  const dispatch = useAppDispatch();
  const trackId = useAppSelector(selectFxBrowserTrackId);
  const trackName = useAppSelector((s) =>
    trackId ? (s.tracks.byId[trackId]?.name ?? null) : null
  );

  const {
    filterText,
    setFilterText,
    clearFilter,
    selectedCategory,
    setSelectedCategory,
    selectedPluginId,
    setSelectedPluginId,
    filteredPlugins,
    reset,
  } = useFxBrowser();

  const isOpen = trackId !== null;

  useEffect(() => {
    if (!isOpen) reset();
  }, [isOpen, reset]);

  const handleClose = useCallback(() => {
    dispatch(closeFxBrowser());
  }, [dispatch]);

  const handleAdd = useCallback(() => {
    if (!selectedPluginId || !trackId) return;

    const plugin = FxCatalog.getById(selectedPluginId);
    if (!plugin?.available) return;

    const pluginId = isNativePlugin(plugin)
      ? `vst3:${plugin.sourcePath!}`
      : plugin.id;

    dispatch(
      addPluginToChain({
        ownerId: trackId,
        pluginId,
        displayName: plugin.name,
      })
    );

    dispatch(openFxChainWindow(trackId));
    dispatch(closeFxBrowser());
  }, [selectedPluginId, trackId, dispatch]);

  const modalTitle = useMemo(
    () => (trackName ? `Add FX to ${trackName}` : 'Add FX'),
    [trackName]
  );

  const canAdd = useMemo(() => {
    if (!selectedPluginId) return false;
    return FxCatalog.getById(selectedPluginId)?.available ?? false;
  }, [selectedPluginId]);

  const addTitle = !selectedPluginId
    ? 'Selecciona un plugin primero'
    : !canAdd
      ? 'Este plugin no está disponible todavía'
      : 'Añadir plugin a la track';

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={modalTitle}
      size="xl"
      closeOnEscape
      closeOnBackdropClick
      showCloseButton
      className="fx-browser-modal"
      footer={
        <>
          <button type="button" className="modal-btn" onClick={handleClose}>
            Cancel
          </button>
          <button
            type="button"
            className="modal-btn is-primary"
            onClick={handleAdd}
            disabled={!canAdd}
            title={addTitle}
          >
            Add
          </button>
        </>
      }
    >
      <div className="fx-browser-filter">
        <label htmlFor="fx-browser-filter-input" className="fx-browser-filter-label">
          Filter:
        </label>
        <input
          id="fx-browser-filter-input"
          type="text"
          className="fx-browser-filter-input"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Buscar plugin por nombre, vendor o descripción..."
          spellCheck={false}
          autoComplete="off"
          autoFocus
        />
        <button
          type="button"
          className="fx-browser-filter-clear"
          onClick={clearFilter}
          disabled={filterText.length === 0}
          title="Limpiar filtro"
        >
          Clear filter
        </button>
      </div>

      <div className="fx-browser-body">
        <FxBrowserSidebar
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />
        <FxBrowserList
          plugins={filteredPlugins}
          selectedPluginId={selectedPluginId}
          onSelectPlugin={setSelectedPluginId}
          onDoubleClickPlugin={(id) => {
            setSelectedPluginId(id);
            const plugin = FxCatalog.getById(id);
            if (plugin?.available) queueMicrotask(handleAdd);
          }}
        />
      </div>
    </Modal>
  );
}

export const FxBrowserModal = memo(FxBrowserModalBase);