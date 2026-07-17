// src/features/fx-chain/components/FxChainPluginUI.tsx

import { memo, useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { FxPluginInstance } from '@domain/models/FxPluginInstance';

export interface FxChainPluginUIProps {
  instance: FxPluginInstance | null;
}

interface Vst3ClassInfo {
  cid:         string;
  cardinality: number;
  category:    string;
  name:        string;
}

interface ProbeResult {
  success:     boolean;
  message:     string;
  bundle_path: string;
  dll_path:    string | null;
  dll_handle:  string | null;
  factory_ptr: string | null;
  classes:     Vst3ClassInfo[];
}

type ProbeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok';    data: ProbeResult }
  | { status: 'error'; message: string };

function isVst3Plugin(pluginId: string): boolean {
  return pluginId.startsWith('vst3:');
}

function extractBundlePath(pluginId: string): string {
  return pluginId.slice('vst3:'.length);
}

function categoryBadgeClass(category: string): string {
  const cat = category.toLowerCase();
  if (cat.includes('audio module'))  return 'vst3-class__badge--audio';
  if (cat.includes('controller'))    return 'vst3-class__badge--controller';
  if (cat.includes('compatibility')) return 'vst3-class__badge--compat';
  return 'vst3-class__badge--other';
}

function categoryShort(category: string): string {
  if (category.includes('Audio Module'))  return 'Audio';
  if (category.includes('Controller'))    return 'Controller';
  if (category.includes('Compatibility')) return 'Compat';
  return category.slice(0, 8);
}

function Vst3ClassTable({ classes }: { classes: Vst3ClassInfo[] }) {
  if (classes.length === 0) {
    return (
      <p className="vst3-probe__no-classes">
        El factory no reportó ninguna clase.
      </p>
    );
  }

  return (
    <div className="vst3-classes">
      {classes.map((cls, i) => (
        <div key={i} className="vst3-class">
          <div className="vst3-class__row vst3-class__row--main">
            <span className="vst3-class__name">{cls.name || '(sin nombre)'}</span>
            <span className={`vst3-class__badge ${categoryBadgeClass(cls.category)}`}>
              {categoryShort(cls.category)}
            </span>
          </div>
          <div className="vst3-class__row vst3-class__row--sub">
            <span className="vst3-class__label">CID</span>
            <span className="vst3-class__cid">{cls.cid}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function Vst3ProbePanel({ data }: { data: ProbeResult }) {
  return (
    <div className="vst3-probe">
      <div className="vst3-probe__header">
        <span className="vst3-probe__icon">✅</span>
        <span className="vst3-probe__title">
          {data.classes.length} clase{data.classes.length !== 1 ? 's' : ''} encontrada{data.classes.length !== 1 ? 's' : ''}
        </span>
      </div>
      <Vst3ClassTable classes={data.classes} />
      <div className="vst3-probe__footer">
        <span className="vst3-probe__meta">
          Factory: <code>{data.factory_ptr ?? '—'}</code>
        </span>
      </div>
    </div>
  );
}

function FxChainPluginUIBase({ instance }: FxChainPluginUIProps) {
  const [probedPluginId, setProbedPluginId] = useState<string | null>(null);
  const [probe, setProbe] = useState<ProbeState>({ status: 'idle' });
  const abortRef = useRef<boolean>(false);

  useEffect(() => {
    if (!instance || !isVst3Plugin(instance.pluginId)) {
      return;
    }

    const pluginId   = instance.pluginId;
    const bundlePath = extractBundlePath(pluginId);

    abortRef.current = true;
    abortRef.current = false;

    let mounted = true;

    const run = async () => {
      await Promise.resolve();
      if (!mounted) return;

      setProbe({ status: 'loading' });
      setProbedPluginId(pluginId);

      try {
        const result = await invoke<ProbeResult>('vst3_probe_plugin', {
          bundlePath,
        });
        if (!mounted) return;
        setProbe({ status: 'ok', data: result });
      } catch (err) {
        if (!mounted) return;
        setProbe({
          status:  'error',
          message: err instanceof Error ? err.message : String(err),
        });
      }
    };

    void run();

    return () => {
      mounted = false;
    };
  }, [instance?.pluginId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const probeIsStale = probedPluginId !== instance.pluginId;

  return (
    <div className="fxchain-plugin-ui">
      <div className="fxchain-plugin-ui__header">
        <span className="fxchain-plugin-ui__name">{instance.displayName}</span>
        <span
          className={`fxchain-plugin-ui__status ${
            instance.enabled ? 'is-active' : 'is-bypassed'
          }`}
        >
          {instance.enabled ? 'Active' : 'Bypassed'}
        </span>
      </div>

      <div className="fxchain-plugin-ui__body fxchain-plugin-ui__body--scroll">

        {!isVst3Plugin(instance.pluginId) && (
          <div className="fxchain-plugin-ui__placeholder">
            <span className="fxchain-plugin-ui__icon">🔧</span>
            <span>{instance.displayName}</span>
            <span className="fxchain-plugin-ui__hint">
              Built-in · {instance.pluginId}
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
        )}

        {isVst3Plugin(instance.pluginId) && (
          <>
            {(probe.status === 'loading' || probeIsStale) && (
              <div className="fxchain-plugin-ui__placeholder">
                <span className="fxchain-plugin-ui__icon vst3-probe__spinner">
                  ⏳
                </span>
                <span>Analizando plugin…</span>
              </div>
            )}

            {probe.status === 'error' && !probeIsStale && (
              <div className="fxchain-plugin-ui__placeholder">
                <span className="fxchain-plugin-ui__icon">❌</span>
                <span>Error al analizar el plugin</span>
                <span className="fxchain-plugin-ui__hint">{probe.message}</span>
              </div>
            )}

            {probe.status === 'ok' && !probeIsStale && (
              <>
                <Vst3ProbePanel data={probe.data} />
                <Vst3OpenEditorButton
                  bundlePath={extractBundlePath(instance.pluginId)}
                  pluginName={instance.displayName}
                />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Botón abrir editor integrado ───────────────────────────────

import { Vst3PluginWindow } from './Vst3PluginWindow';

function Vst3OpenEditorButton({
  bundlePath,
  pluginName,
}: {
  bundlePath: string;
  pluginName: string;
}) {
  return (
    <div style={{ marginTop: '12px' }}>
      <Vst3PluginWindow
        bundlePath={bundlePath}
        pluginName={pluginName}
      />
    </div>
  );
}

export const FxChainPluginUI = memo(FxChainPluginUIBase);