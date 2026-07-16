// src/state/middleware/audioSync/helpers.ts
import { audioEngine } from '@audio/engine/AudioEngine';
import { isPanLaw, type PanLaw } from '@domain/enums/PanLaw';
import { log, errMsg } from './config';
import type { AudioSyncApi } from './types';

export function isAudioReady(): boolean {
  return audioEngine.isInitialized;
}

export function safeEffect<TAction>(
  name: string,
  fn: (action: TAction, api: AudioSyncApi) => void | Promise<void>
) {
  return async (action: TAction, api: AudioSyncApi) => {
    try {
      await fn(action, api);
    } catch (err) {
      log(`Error en ${name}: ${errMsg(err)}`, 'error');
    }
  };
}

export function ensurePanLaw(value: string, fallback: PanLaw = '-3dB'): PanLaw {
  if (isPanLaw(value)) return value;
  log(
    `Pan law inválido en el store: "${value}". Usando fallback "${fallback}".`,
    'warn'
  );
  return fallback;
}