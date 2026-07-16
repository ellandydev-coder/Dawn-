// src/audio/recording/recorder-worklet-loader.ts

import recorderProcessorUrl from '@audio/worklets/processors/RecorderProcessor.ts?worker&url';

/**
 * Carga idempotente y concurrency-safe del RecorderProcessor worklet.
 *
 * - Cachea por AudioContext (WeakSet, se libera con GC)
 * - Deduplica llamadas concurrentes en la misma promesa
 */

export const RECORDER_WORKLET_PROCESSOR_NAME = 'recorder-processor';

let inFlightPromise: Promise<void> | null = null;
const loadedContexts = new WeakSet<AudioContext>();

export async function loadRecorderWorklet(ctx: AudioContext): Promise<void> {
  if (loadedContexts.has(ctx)) return;
  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = ctx.audioWorklet
    .addModule(recorderProcessorUrl)
    .then(() => {
      loadedContexts.add(ctx);
      inFlightPromise = null;
    })
    .catch((err: unknown) => {
      inFlightPromise = null;
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(
        `[RecorderWorkletLoader] No se pudo cargar el AudioWorklet. Causa: ${msg}`
      );
    });

  return inFlightPromise;
}