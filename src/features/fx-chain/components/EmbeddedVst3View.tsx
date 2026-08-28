// src/features/fx-chain/components/EmbeddedVst3View.tsx

import { useRef } from 'react';
import { useEmbeddedEditorBounds } from '../hooks/useEmbeddedEditorBounds';

interface EmbeddedVst3ViewProps {
  bundlePath: string;
  instanceId: string;
}

export function EmbeddedVst3View({ bundlePath, instanceId }: EmbeddedVst3ViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEmbeddedEditorBounds(containerRef, bundlePath, instanceId);

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