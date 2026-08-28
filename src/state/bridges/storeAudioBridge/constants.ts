// src/state/bridges/storeAudioBridge/constants.ts

export const LOG_PREFIX = '[StoreAudioBridge]';

export function toBridgeError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

export function defaultBridgeVerbose(): boolean {
  return Boolean(import.meta.env?.DEV);
}