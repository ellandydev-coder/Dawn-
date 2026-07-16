// src/features/fx-chain/components/FxChainWindow.tsx

import { memo, useState, useCallback, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '@state/store';
import { closeFxChainWindow } from '@state/slices/ui/uiSlice';
import { selectFxChainByOwnerId } from '@state/slices/fxChains/fxChainsSlice';
import { FloatingWindow } from '@shared/components/FloatingWindow';
import { FxChainList } from './FxChainList';
import { FxChainPluginUI } from './FxChainPluginUI';

import './FxChainWindow.css';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface FxChainWindowProps {
  /** Track cuya FX Chain se muestra */
  trackId: string;
  /** Offset para escalonar ventanas múltiples (evita que se apilen) */
  windowIndex?: number;
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ CONSTANTES
// ═══════════════════════════════════════════════════════════════

const BASE_X = 200;
const BASE_Y = 120;
const STAGGER = 30;
const WINDOW_WIDTH = 560;
const WINDOW_MIN_HEIGHT = 320;

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * FxChainWindow
 * -------------
 * Ventana flotante estilo REAPER para ver/editar la cadena de
 * efectos de una track.
 *
 * Toda la lógica de "chrome" (drag, pin, close, portal, titlebar)
 * la hereda de `<FloatingWindow>`. Este componente solo aporta:
 *   • El contenido específico (lista de plugins + panel UI)
 *   • La conexión al store (trackId → chain, dispatch de close)
 *   • Selección interna del plugin activo
 */
function FxChainWindowBase({ trackId, windowIndex = 0 }: FxChainWindowProps) {
  const dispatch = useAppDispatch();

  // ─── Store data ─────────────────────────────────────────────

  const trackName = useAppSelector(
    (s) => s.tracks.byId[trackId]?.name ?? `Track ${trackId}`
  );

  const chain = useAppSelector((s) => selectFxChainByOwnerId(s, trackId));

  // ─── Local state ────────────────────────────────────────────

  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  // ─── Derivados ──────────────────────────────────────────────

  const plugins = useMemo(() => chain?.plugins ?? [], [chain?.plugins]);

  const selectedInstance = useMemo(
    () => plugins.find((p) => p.id === selectedInstanceId) ?? null,
    [plugins, selectedInstanceId]
  );

  const title = `FX: ${trackName}`;

  // ─── Handlers ───────────────────────────────────────────────

  const handleClose = useCallback(() => {
    dispatch(closeFxChainWindow(trackId));
  }, [dispatch, trackId]);

  const handleSelect = useCallback((instanceId: string) => {
    setSelectedInstanceId(instanceId);
  }, []);

  // ─── Render ─────────────────────────────────────────────────

  return (
    <FloatingWindow
      title={title}
      onClose={handleClose}
      initialX={BASE_X + windowIndex * STAGGER}
      initialY={BASE_Y + windowIndex * STAGGER}
      width={WINDOW_WIDTH}
      minHeight={WINDOW_MIN_HEIGHT}
      className="fxchain-window"
      dataAttrs={{ 'data-track-id': trackId }}
    >
      <FxChainList
        ownerId={trackId}
        plugins={plugins}
        selectedInstanceId={selectedInstanceId}
        onSelect={handleSelect}
      />
      <FxChainPluginUI instance={selectedInstance} />
    </FloatingWindow>
  );
}

export const FxChainWindow = memo(FxChainWindowBase);