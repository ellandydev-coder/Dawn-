// src/audio/recording/recorder.types.ts

/**
 * Tipos locales para el módulo de grabación.
 * Complementan a los contratos genéricos de domain/contracts/audio/.
 */

export interface MicRecorderConfig {
  /** ID del dispositivo a usar (default: micrófono por defecto del sistema) */
  deviceId?: string;

  /** Canales a grabar: 1 = mono, 2 = stereo (default: 1) */
  channelCount?: number;

  /** Activar monitoring al armar (default: false) */
  monitoring?: boolean;

  /** Ganancia de entrada 0..4 (default: 1, unity gain) */
  inputGain?: number;

  /** Tamaño del buffer de captura en segundos (default: 300 = 5min) */
  maxDurationSec?: number;

  /** Habilitar logs (default: true en dev) */
  verbose?: boolean;
}

export const DEFAULT_MIC_RECORDER_CONFIG: Required<MicRecorderConfig> = {
  deviceId: 'default',
  channelCount: 1,
  monitoring: false,
  inputGain: 1,
  maxDurationSec: 300,
  verbose: import.meta.env?.DEV ?? false,
};

/**
 * Mensaje enviado por el RecorderProcessor (AudioWorklet)
 * al hilo principal con samples capturados.
 */
export interface RecorderProcessorMessage {
  type: 'samples';
  /** Samples Float32Array por canal */
  channels: Float32Array[];
  /** Número de sample en el que empieza este bloque (para reconstruir) */
  sampleOffset: number;
}

/**
 * Mensaje enviado al RecorderProcessor desde el hilo principal.
 */
export type RecorderProcessorCommand =
  | { type: 'start' }
  | { type: 'stop' }
  | { type: 'clear' };