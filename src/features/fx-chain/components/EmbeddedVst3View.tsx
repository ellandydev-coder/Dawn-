// src/features/fx-chain/components/EmbeddedVst3View.tsx

import { useRef } from 'react';
import type { FxPluginInstance } from '@domain/models/FxPluginInstance';
import { useEmbeddedEditorBounds } from '../hooks/useEmbeddedEditorBounds';
import { GenericPluginParams } from './GenericPluginParams';

interface EmbeddedVst3ViewProps {
  bundlePath: string;
  instanceId: string;
  instance?: FxPluginInstance;
}

export function EmbeddedVst3View({ bundlePath, instanceId, instance }: EmbeddedVst3ViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { hasFailed } = useEmbeddedEditorBounds(containerRef, bundlePath, instanceId);

  if (hasFailed) {
    return (
      <div className="embedded-vst3-container" style={{ width: '100%', height: '100%', minHeight: '350px', background: '#16181d', display: 'flex', flexDirection: 'column', borderRadius: 8, overflow: 'hidden', border: '1px solid #2a2d35' }}>
        <div style={{ background: '#1e2028', padding: '12px 16px', borderBottom: '1px solid #2a2d35', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18 }}>🎛️</span>
          <div>
            <div style={{ fontWeight: 600, color: '#e8e8e8', fontSize: 13 }}>{instance?.displayName ?? 'Plugin VST3'}</div>
            <div style={{ color: '#888', fontSize: 11 }}>Controles del plugin (interfaz nativa no disponible)</div>
          </div>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          {instance ? <GenericPluginParams instance={instance} /> : (
            <div style={{ padding: 20, color: '#aaa', fontSize: 13 }}>No hay parámetros disponibles.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="embedded-vst3-container"
      style={{ width: '100%', height: '100%', minHeight: '350px', background: '#111' }}
    />
  );
}
