// src/state/bridges/storeAudioBridge/transportSnapshot.ts

import type { RootState } from '@state/store';
import type { TransportSnapshot } from './types';

export function takeTransportSnapshot(state: RootState): TransportSnapshot {
  return {
    isPlaying: state.transport.isPlaying,
    isRecording: state.transport.isRecording,
    editCursorSeconds: state.transport.editCursorSeconds,
    loopEnabled: state.transport.loopEnabled,
    loopStart: state.transport.loopStart,
    loopEnd: state.transport.loopEnd,
  };
}

export function createEmptyTransportSnapshot(): TransportSnapshot {
  return {
    isPlaying: false,
    isRecording: false,
    editCursorSeconds: 0,
    loopEnabled: false,
    loopStart: 0,
    loopEnd: 0,
  };
}