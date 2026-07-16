// src/features/timeline/components/TrackResizeHandle.tsx

import { memo, useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import { setTrackHeight } from '@state/slices/tracks/tracksSlice';
import { useVerticalResize } from '@shared/hooks/useVerticalResize';
import './TrackResizeHandle.css';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

// Deben coincidir con MIN_TRACK_HEIGHT / MAX_TRACK_HEIGHT del slice.
// Si el slice cambia, aquí solo servirán como fallback visual —
// el reducer aplicará su propio clamp de todos modos.
const MIN_TRACK_HEIGHT = 72;
const MAX_TRACK_HEIGHT = 320;

// ═══════════════════════════════════════════════════════════════
// 🎯 PROPS
// ═══════════════════════════════════════════════════════════════

export interface TrackResizeHandleProps {
  trackId: string;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * TrackResizeHandle
 * -----------------
 * Handle horizontal en el borde inferior del TrackHeader.
 * Al arrastrar hacia abajo → aumenta la altura de la track.
 * Al arrastrar hacia arriba → disminuye la altura.
 *
 * Es autocontenido: sabe leer el track del store y hacer dispatch.
 * Reutiliza useVerticalResize (genérico).
 */
function TrackResizeHandleBase({ trackId }: TrackResizeHandleProps) {
  const dispatch = useAppDispatch();
  const currentHeight = useAppSelector(
    (s) => s.tracks.byId[trackId]?.height ?? 80
  );

  const handleCommit = useCallback(
    (finalHeight: number) => {
      dispatch(setTrackHeight({ id: trackId, height: finalHeight }));
    },
    [dispatch, trackId]
  );

  // Durante el drag, hacemos dispatch en vivo para feedback inmediato.
  // El reducer ya aplica clamp, así que es seguro.
  const handleChange = useCallback(
    (nextHeight: number) => {
      dispatch(setTrackHeight({ id: trackId, height: nextHeight }));
    },
    [dispatch, trackId]
  );

  const { onMouseDown, isDragging } = useVerticalResize({
    initialSize: currentHeight,
    onCommit: handleCommit,
    onChange: handleChange,
    minSize: MIN_TRACK_HEIGHT,
    maxSize: MAX_TRACK_HEIGHT,
  });

  const className = `track-resize-handle${isDragging ? ' is-dragging' : ''}`;

  return (
    <div
      className={className}
      onMouseDown={onMouseDown}
      role="separator"
      aria-orientation="horizontal"
      aria-label="Redimensionar altura de la pista"
      title="Arrastra para cambiar la altura de la pista"
    />
  );
}

export const TrackResizeHandle = memo(TrackResizeHandleBase);