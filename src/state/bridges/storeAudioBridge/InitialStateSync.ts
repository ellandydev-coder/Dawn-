// src/state/bridges/storeAudioBridge/InitialStateSync.ts

import { audioEngine } from '@audio/engine/AudioEngine';
import type { RootState } from '@state/store';
import type { StoreAudioBridgeEmitter } from './StoreAudioBridgeEmitter';

export type InitialStateSyncLog = (
  message: string,
  level?: 'info' | 'warn' | 'error'
) => void;

/**
 * Refleja el estado actual de Redux en los nodos de audio
 * (master + tracks). Usado en attach() y resync().
 */
export class InitialStateSync {
  private readonly _emitter: StoreAudioBridgeEmitter;
  private readonly _log: InitialStateSyncLog;

  constructor(emitter: StoreAudioBridgeEmitter, log: InitialStateSyncLog) {
    this._emitter = emitter;
    this._log = log;
  }

  public sync(state: RootState): number {
    if (!audioEngine.isInitialized) {
      this._log('_syncInitialState ignorado: engine no inicializado', 'warn');
      return 0;
    }

    // Master
    audioEngine.setMasterVolume(state.mixer.global.masterVolume);
    audioEngine.setMuted(state.mixer.global.masterMuted);

    // Tracks
    let syncedTracks = 0;
    const anySoloed = state.tracks.allIds.some(
      (id) => state.tracks.byId[id]?.soloed === true
    );

    for (const id of state.tracks.allIds) {
      const track = state.tracks.byId[id];
      if (!track) continue;

      try {
        const node = audioEngine.routingGraph.createTrack(id);
        node.setVolume(track.volume);
        node.setPan(track.pan);

        const shouldMute = anySoloed
          ? !track.soloed || track.muted
          : track.muted;
        node.setMuted(shouldMute);

        syncedTracks += 1;
      } catch (err) {
        this._log(`Error sincronizando track ${id}: ${err}`, 'warn');
      }
    }

    this._emitter.emit({
      type: 'initialStateSynced',
      trackCount: syncedTracks,
    });
    this._log(`Estado inicial sincronizado: ${syncedTracks} tracks`);

    return syncedTracks;
  }
}