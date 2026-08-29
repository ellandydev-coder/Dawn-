// src/features/fx-chain/components/FxChainPluginUI.tsx

import { memo } from 'react';
import type { FxPluginInstance } from '@domain/models/FxPluginInstance';
import { GenericPluginParams } from './GenericPluginParams';
import { EmbeddedVst3View } from './EmbeddedVst3View';

export interface FxChainPluginUIProps {
  instance: FxPluginInstance | null;
}

function isVst3Plugin(pluginId: string): boolean {
  return pluginId.startsWith('vst3:');
}

function extractBundlePath(pluginId: string): string {
  if (!pluginId.startsWith('vst3:')) {
    throw new Error(`pluginId no es VST3: ${pluginId}`);
  }
  const path = pluginId.slice('vst3:'.length);
  if (!path || path.length === 0) {
    throw new Error('bundlePath vacío para plugin VST3');
  }
  return path;
}

function FxChainPluginUIBase({ instance }: FxChainPluginUIProps) {
  if (!instance) {
    return (
      <div className="fxchain-plugin-ui fxchain-plugin-ui--empty">
        <div className="fxchain-plugin-ui__placeholder">
          <span className="fxchain-plugin-ui__icon">🎛️</span>
          <span>No plugin selected</span>
        </div>
      </div>
    );
  }

  const isVst3 = isVst3Plugin(instance.pluginId);

  return (
    <div className="fxchain-plugin-ui">
      {/* Toolbar Superior idéntica a REAPER */}
      <div className="reaper-fx-toolbar">
        <select className="reaper-preset-select">
          <option>No preset</option>
        </select>
        <button type="button" className="reaper-tb-btn">+</button>
        <button type="button" className="reaper-tb-btn">Param</button>
        <button type="button" className="reaper-tb-btn">2 in 2 out</button>
        <div className="reaper-tb-wetdry" title="Wet/Dry Balance">
          <div className="reaper-knob-placeholder" />
        </div>
        <label className="reaper-tb-bypass" title="Bypass effect">
          <input type="checkbox" checked={instance.enabled} readOnly />
        </label>
      </div>

      {/* ÁREA PRINCIPAL EMBEBIDA */}
      <div className="fxchain-plugin-ui__body">
        {isVst3 ? (
          <EmbeddedVst3View
            bundlePath={extractBundlePath(instance.pluginId)}
            instanceId={instance.id}
            instance={instance}
          />
        ) : (
          <GenericPluginParams instance={instance} />
        )}
      </div>

      {/* Barra de Estado Inferior REAPER */}
      <div className="reaper-fx-statusbar">
        <span>0.02%/0.02% 22050/22528 spls</span>
      </div>
    </div>
  );
}

export const FxChainPluginUI = memo(FxChainPluginUIBase);