/**
 * useTransportControls.ts
 * -----------------------
 * Hook central con la lógica del transport.
 * Se usa desde la TransportBar, atajos de teclado, MIDI controllers, etc.
 */

import { useCallback } from 'react';
import { useAppDispatch, useAppSelector } from '@state/store';
import {
  play,
  pause,
  stop,
  toggleRecord,
  setPlayhead,
  toggleLoop,
  toggleMetronome,
} from '@state/slices/transport/transportSlice';

export function useTransportControls() {
  const dispatch = useAppDispatch();
  const isPlaying = useAppSelector((s) => s.transport.isPlaying);
  const isRecording = useAppSelector((s) => s.transport.isRecording);
  const playheadSeconds = useAppSelector((s) => s.transport.playheadSeconds);

  const togglePlay = useCallback(() => {
    if (isPlaying) dispatch(pause());
    else dispatch(play());
  }, [dispatch, isPlaying]);

  const stopTransport = useCallback(() => {
    dispatch(stop());
  }, [dispatch]);

  const record = useCallback(() => {
    dispatch(toggleRecord());
  }, [dispatch]);

  const goToStart = useCallback(() => {
    dispatch(setPlayhead(0));
  }, [dispatch]);

  const seek = useCallback(
    (seconds: number) => dispatch(setPlayhead(seconds)),
    [dispatch]
  );

  const toggleLoopMode = useCallback(() => dispatch(toggleLoop()), [dispatch]);
  const toggleMetro = useCallback(() => dispatch(toggleMetronome()), [dispatch]);

  return {
    isPlaying,
    isRecording,
    playheadSeconds,
    togglePlay,
    stopTransport,
    record,
    goToStart,
    seek,
    toggleLoopMode,
    toggleMetro,
  };
}