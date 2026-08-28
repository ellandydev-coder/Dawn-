// src/features/fx-chain/components/FxChainWindow.tsx

import { memo, useState, useCallback, useMemo } from 'react';
import { useAppSelector, useAppDispatch } from '@state/store';
import { closeFxChainWindow } from '@state/slices/ui/uiSlice';
import { selectFxChainByOwnerId } from '@state/slices/fxChains/fxChainsSlice';
import { FloatingWindow } from '@shared/components/FloatingWindow';
import { FxChainList } from './FxChainList';
import { FxChainPluginUI } from './FxChainPluginUI';

import './FxChainWindow.css';

export interface FxChainWindowProps {
  trackId: string;
  windowIndex?: number;
}

const BASE_X = 180;
const BASE_Y = 100;
const STAGGER = 25;
const WINDOW_WIDTH = 680;
const WINDOW_MIN_HEIGHT = 440;

function FxChainWindowBase({ trackId, windowIndex = 0 }: FxChainWindowProps) {
  const dispatch = useAppDispatch();

  const trackName = useAppSelector(
    (s) => s.tracks.byId[trackId]?.name ?? `Track ${trackId}`
  );
  const chain = useAppSelector((s) => selectFxChainByOwnerId(s, trackId));
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  const plugins = useMemo(() => chain?.plugins ?? [], [chain?.plugins]);

  const selectedInstance = useMemo(
    () => plugins.find((p) => p.id === selectedInstanceId) ?? plugins[0] ?? null,
    [plugins, selectedInstanceId]
  );

  const handleClose = useCallback(() => {
    dispatch(closeFxChainWindow(trackId));
  }, [dispatch, trackId]);

  return (
    <FloatingWindow
      title={`FX: ${trackName}`}
      onClose={handleClose}
      initialX={BASE_X + windowIndex * STAGGER}
      initialY={BASE_Y + windowIndex * STAGGER}
      width={WINDOW_WIDTH}
      minHeight={WINDOW_MIN_HEIGHT}
      className="fxchain-window reaper-theme"
    >
      {/* Menú Superior estilo REAPER */}
      <div className="reaper-window-menubar">
        <span>FX</span>
        <span>Edit</span>
        <span>Options</span>
      </div>

      <div className="fxchain-window__content">
        <FxChainList
          ownerId={trackId}
          plugins={plugins}
          selectedInstanceId={selectedInstance?.id ?? null}
          onSelect={setSelectedInstanceId}
        />
        <FxChainPluginUI instance={selectedInstance} />
      </div>
    </FloatingWindow>
  );
}

export const FxChainWindow = memo(FxChainWindowBase);