// src/features/fx-chain/components/GenericPluginParams.tsx

import { memo, useMemo } from 'react';
import type { FxPluginInstance } from '@domain/models/FxPluginInstance';
import './GenericPluginParams.css';

export interface GenericPluginParamsProps {
  instance: FxPluginInstance;
  onParamChange?: (paramId: string, value: number) => void;
}

/**
 * Interface por defecto estilo REAPER para plugins sin GUI nativa o integrados.
 * Muestra vúmetros laterales verdes de picos y sliders horizontales numéricos.
 */
function GenericPluginParamsBase({ instance, onParamChange }: GenericPluginParamsProps) {
  // Parámetros de demostración o leídos del modelo
  const defaultParams = useMemo(() => {
    if (Object.keys(instance.params).length > 0) {
      return instance.params;
    }
    return {
      'Threshold (dB)': 0.0,
      'Ceiling (dB)': 0.0,
      'Buffer Size (ms)': 500.0,
    };
  }, [instance.params]);

  return (
    <div className="reaper-fx-panel">
      {/* VÚmetro Izquierdo */}
      <div className="reaper-vumeter">
        <div className="reaper-vumeter__ticks">
          <span>-inf</span>
          <span>-0</span>
          <span>-6</span>
          <span>-12</span>
          <span>-18</span>
          <span>-24</span>
          <span>-30</span>
          <span>-36</span>
          <span>-42</span>
          <span>-48</span>
          <span>-54</span>
          <span>-60</span>
          <span>-80</span>
        </div>
        <div className="reaper-vumeter__bar-container">
          <div className="reaper-vumeter__bar" style={{ height: '35%' }} />
        </div>
      </div>

      {/* Panel Central de Parámetros */}
      <div className="reaper-params-container">
        <div className="reaper-plugin-header">
          <span className="reaper-plugin-title">{instance.displayName}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="reaper-btn-edit"
              onClick={() => {
                const resetEvent = new CustomEvent('reset-params', { detail: instance.id });
                window.dispatchEvent(resetEvent);
              }}
            >
              Reset
            </button>
            <button type="button" className="reaper-btn-edit">Edit...</button>
          </div>
        </div>

        <div className="reaper-params-list">
          {Object.entries(defaultParams).map(([name, val]) => (
            <div key={name} className="reaper-param-row">
              <label className="reaper-param-label">{name}</label>
              <div className="reaper-slider-wrapper">
                <input
                  type="range"
                  className="reaper-slider"
                  min={name.includes('ms') ? 0 : -60}
                  max={name.includes('ms') ? 1000 : 12}
                  step={0.1}
                  value={val}
                  onChange={(e) => onParamChange?.(name, parseFloat(e.target.value))}
                />
              </div>
              <span className="reaper-param-value">{val.toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* VÚmetro Derecho */}
      <div className="reaper-vumeter">
        <div className="reaper-vumeter__ticks">
          <span>-inf</span>
          <span>-0</span>
          <span>-6</span>
          <span>-12</span>
          <span>-18</span>
          <span>-24</span>
          <span>-30</span>
          <span>-36</span>
          <span>-42</span>
          <span>-48</span>
          <span>-54</span>
          <span>-60</span>
          <span>-80</span>
        </div>
        <div className="reaper-vumeter__bar-container">
          <div className="reaper-vumeter__bar" style={{ height: '35%' }} />
        </div>
      </div>
    </div>
  );
}

export const GenericPluginParams = memo(GenericPluginParamsBase);