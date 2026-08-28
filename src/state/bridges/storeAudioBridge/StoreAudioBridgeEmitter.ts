// src/state/bridges/storeAudioBridge/StoreAudioBridgeEmitter.ts

import { LOG_PREFIX } from './constants';
import type {
  StoreAudioBridgeEvent,
  StoreAudioBridgeListener,
} from './types';

export class StoreAudioBridgeEmitter {
  private readonly _listeners = new Set<StoreAudioBridgeListener>();

  public on(listener: StoreAudioBridgeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  public emit(event: StoreAudioBridgeEvent): void {
    for (const listener of this._listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error(LOG_PREFIX, 'Error en listener:', err);
      }
    }
  }

  public clear(): void {
    this._listeners.clear();
  }
}