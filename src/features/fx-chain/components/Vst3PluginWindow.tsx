// src/features/fx-chain/components/Vst3PluginWindow.tsx
//
// Componente que gestiona un plugin VST3 en la FX chain.
// Muestra un botón para abrir/cerrar la ventana nativa del plugin.

import React from 'react';
import { useVst3 } from '../hooks/useVst3';

interface Vst3PluginWindowProps {
  /** Ruta al bundle .vst3 */
  bundlePath: string;
  /** Nombre visible del plugin */
  pluginName: string;
  /** Callback cuando el editor se abre exitosamente */
  onEditorOpen?: (width: number, height: number) => void;
  /** Callback cuando el editor se cierra */
  onEditorClose?: () => void;
}

export const Vst3PluginWindow: React.FC<Vst3PluginWindowProps> = ({
  bundlePath,
  pluginName,
  onEditorOpen,
  onEditorClose,
}) => {
  const {
    status,
    width,
    height,
    error,
    openEditor,
    closeEditor,
  } = useVst3(bundlePath);

  const handleOpen = async () => {
    await openEditor();
    if (status !== 'error' && onEditorOpen) {
      onEditorOpen(width, height);
    }
  };

  const handleClose = async () => {
    await closeEditor();
    onEditorClose?.();
  };

  return (
    <div style={styles.container}>
      {/* Nombre del plugin */}
      <span style={styles.name}>{pluginName}</span>

      {/* Estado */}
      {status === 'error' && (
        <span style={styles.error} title={error ?? ''}>
          ⚠️ Error
        </span>
      )}

      {status === 'editor_open' && (
        <span style={styles.info}>
          {width}×{height}
        </span>
      )}

      {/* Botón principal */}
      {status === 'idle' || status === 'error' ? (
        <button
          style={styles.button}
          onClick={handleOpen}
          title={`Abrir editor de ${pluginName}`}
        >
          🎛 Abrir
        </button>
      ) : status === 'loading' ? (
        <button style={{ ...styles.button, opacity: 0.5 }} disabled>
          ⏳ Cargando...
        </button>
      ) : (
        <button
          style={{ ...styles.button, ...styles.buttonClose }}
          onClick={handleClose}
          title={`Cerrar editor de ${pluginName}`}
        >
          ✕ Cerrar
        </button>
      )}
    </div>
  );
};

// ── Estilos inline (sin dependencias externas) ─────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display:        'flex',
    alignItems:     'center',
    gap:            '8px',
    padding:        '6px 10px',
    background:     '#1e1e2e',
    borderRadius:   '6px',
    border:         '1px solid #313244',
    fontFamily:     'monospace',
    fontSize:       '13px',
    color:          '#cdd6f4',
    minWidth:       '220px',
  },
  name: {
    flex:           1,
    overflow:       'hidden',
    textOverflow:   'ellipsis',
    whiteSpace:     'nowrap',
  },
  info: {
    fontSize:       '11px',
    color:          '#a6e3a1',
  },
  error: {
    fontSize:       '11px',
    color:          '#f38ba8',
    cursor:         'help',
  },
  button: {
    padding:        '3px 10px',
    borderRadius:   '4px',
    border:         'none',
    background:     '#89b4fa',
    color:          '#1e1e2e',
    cursor:         'pointer',
    fontSize:       '12px',
    fontWeight:     600,
    whiteSpace:     'nowrap',
  },
  buttonClose: {
    background:     '#f38ba8',
  },
};