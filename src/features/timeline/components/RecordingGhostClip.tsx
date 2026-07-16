// src/features/timeline/components/RecordingGhostClip.tsx
//
// Rectángulo rojo translúcido que crece en tiempo real durante
// la grabación. Vive dentro de la TrackLane armada.
//
// - Empieza en editCursorSeconds (posición actual del transport)
// - Crece usando audioEngine.currentTime a 60fps (requestAnimationFrame)
// - Desaparece cuando termina la grabación (el clip real ocupa su lugar)

import { memo, useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAppSelector } from '@state/store';
import { audioEngine } from '@audio/engine/AudioEngine';
import './RecordingGhostClip.css';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const MIN_WIDTH_PX = 4;

// ═══════════════════════════════════════════════════════════════
// 🎯 PROPS
// ═══════════════════════════════════════════════════════════════

export interface RecordingGhostClipProps {
  trackId: string;
  bpm: number;
  secondsToPx: (seconds: number, bpm: number) => number;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

function RecordingGhostClipBase({ trackId, bpm, secondsToPx }: RecordingGhostClipProps) {
  const isRecording = useAppSelector((s) => s.transport.isRecording);
  const isCountingIn = useAppSelector((s) => s.transport.isCountingIn);
  const isArmed = useAppSelector((s) => s.tracks.byId[trackId]?.armed ?? false);
  const editCursorSec = useAppSelector((s) => s.transport.editCursorSeconds);

  // Solo mostrar si esta track está armada Y estamos grabando de verdad
  const isActive = isRecording && !isCountingIn && isArmed;

  // Duración actual del clip fantasma (crece en tiempo real)
  const [durationSec, setDurationSec] = useState(0);

  // Tiempo del audio engine en el momento de arrancar
  const startAudioTimeRef = useRef<number | null>(null);
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!isActive) {
      // Reset silencioso: sin setState (el componente retorna null → no se ve nada).
      // El durationSec del render anterior queda "colgado" pero es irrelevante
      // porque no se pinta. Cuando vuelva a activarse, tick() lo actualizará
      // en su primer frame con el valor real basado en audioEngine.currentTime.
      startAudioTimeRef.current = null;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      return;
    }

    // Arrancar: marcar el tiempo inicial del audio engine
    startAudioTimeRef.current = audioEngine.currentTime;

    const tick = () => {
      const start = startAudioTimeRef.current;
      if (start === null) return;

      const elapsed = audioEngine.currentTime - start;
      setDurationSec(elapsed > 0 ? elapsed : 0);

      rafIdRef.current = requestAnimationFrame(tick);
    };

    rafIdRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isActive]);

  if (!isActive) return null;

  const leftPx = secondsToPx(editCursorSec, bpm);
  const widthPx = Math.max(MIN_WIDTH_PX, secondsToPx(durationSec, bpm));

  const style: CSSProperties = {
    left: leftPx,
    width: widthPx,
  };

  return (
    <div
      className="rec-ghost"
      style={style}
      aria-hidden="true"
      data-track-id={trackId}
    >
      <div className="rec-ghost-label">
        <span className="rec-ghost-dot" />
        <span className="rec-ghost-text">REC</span>
      </div>
    </div>
  );
}

export const RecordingGhostClip = memo(RecordingGhostClipBase);