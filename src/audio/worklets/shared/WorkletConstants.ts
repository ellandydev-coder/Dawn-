// src/audio/worklets/shared/WorkletConstants.ts

/** Tamaño típico de quantum de AudioWorklet (puede variar). */
export const DEFAULT_QUANTUM_FRAMES = 128;

/** Capacidad del ring en frames (por canal). ~100 ms @ 48 kHz */
export const VST3_RING_FRAMES = 4800;

/** Máximo block que pediremos a Rust en la fase IPC. */
export const VST3_MAX_BLOCK = 512;

export const VST3_INSERT_PROCESSOR_NAME = 'vst3-insert-processor';