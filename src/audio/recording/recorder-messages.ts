// src/audio/recording/recorder-messages.ts

/**
 * Tipos de mensajes entre RecorderProcessor (worklet) y MicRecorder (main).
 * Aislados para poder reutilizarse desde ambos lados sin duplicar.
 */

/** Comandos: main → worklet */
export type RecorderCommand =
  | { type: 'start' }
  | { type: 'stop' };

/** Mensajes: worklet → main */
export interface RecorderSamplesMessage {
  type: 'samples';
  channels: Float32Array[];
  sampleOffset: number;
  sampleRate: number;
}

export interface RecorderStartedMessage {
  type: 'started';
  sampleRate: number;
  startSample: number;
}

export interface RecorderStoppedMessage {
  type: 'stopped';
  totalSamples: number;
}

export type RecorderWorkletMessage =
  | RecorderSamplesMessage
  | RecorderStartedMessage
  | RecorderStoppedMessage;