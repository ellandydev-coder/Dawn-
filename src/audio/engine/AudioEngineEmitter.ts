// src/audio/engine/AudioEngineEmitter.ts

import type { AudioEngineEvent, AudioEngineListener } from './types';

/**
 * Bus de eventos del engine.
 * Separado para no mezclar pub/sub con DSP/lifecycle.
 */
export class AudioEngineEmitter {
  private readonly _listeners = new Set<AudioEngineListener>();

  public on(listener: AudioEngineListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  public emit(event: AudioEngineEvent): void {
    const snapshot = Array.from(this._listeners);
    for (const listener of snapshot) {
      try {
        listener(event);
      } catch (err) {
        console.error('[AudioEngine] Error en listener:', err);
      }
    }
  }

  public clear(): void {
    this._listeners.clear();
  }

  public get size(): number {
    return this._listeners.size;
  }
}