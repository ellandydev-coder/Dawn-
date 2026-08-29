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
  const { hasFailed, errorMessage } = useEmbeddedEditorBounds(containerRef, bundlePath, instanceId);

  if (hasFailed) {
    return (
      <div className="embedded-vst3-container" style={{ width: '100%', height: '100%', minHeight: '350px', background: '#111', display: 'flex', flexDirection: 'column' }}>
        <div style={{ color: '#ff6666', padding: 16, fontSize: 13, borderBottom: '1px solid #333' }}>
          ⚠️ Editor nativo no disponible
        </div>
        <div style={{ color: '#aaa', padding: 16, fontSize: 12 }}>
          {errorMessage || 'El plugin no provee interfaz gráfica (createView devolvió NULL)'}
        </div>
        {instance ? (
          <GenericPluginParams instance={instance} />
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="embedded-vst3-container"
      style={{
        width: '100%',
        height: '100%',
        minHeight: '350px',
        background: '#111',
      }}
    />
  );
}
