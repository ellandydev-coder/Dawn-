// src/audio/worklets/processors/Vst3InsertProcessor.ts
//
// AudioWorkletProcessor que inserta un VST3 en la cadena de audio.

import { VST3_INSERT_PROCESSOR_NAME } from '../shared/WorkletConstants';

// ── Declaraciones de tipos para el ámbito global del AudioWorklet ──
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
}

declare function registerProcessor(
  name: string,
  processorCtor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor
): void;

interface Vst3InsertOptions {
  pluginKey: string;
  instanceId: string;
  bypass?: boolean;
}

class Vst3InsertProcessor extends AudioWorkletProcessor {
  private _pluginKey: string;
  private _instanceId: string;
  private _bypass: boolean;

  // Buffer de salida pendiente (llega async desde main thread)
  private _pendingOutL: Float32Array | null = null;
  private _pendingOutR: Float32Array | null = null;
  private _pendingOffset = 0;

  // Contador para no saturar IPC (pedir cada N quanta)
  private _requestThrottle = 0;
  private static readonly THROTTLE_INTERVAL = 2; // cada 2 quanta (~5.3ms @48k)

  constructor(options?: AudioWorkletNodeOptions) {
    super(options);

    const opts = (options?.processorOptions ?? {}) as Vst3InsertOptions;
    this._pluginKey = opts.pluginKey ?? '';
    this._instanceId = opts.instanceId ?? '';
    this._bypass = opts.bypass ?? false;

    // Escuchar resultados del main thread
    this.port.onmessage = (e: MessageEvent) => {
      const { type, outputL, outputR } = e.data;
      if (type === 'processResult') {
        this._pendingOutL = new Float32Array(outputL);
        this._pendingOutR = new Float32Array(outputR);
        this._pendingOffset = 0;
      } else if (type === 'setBypass') {
        this._bypass = !!e.data.bypass;
      } else if (type === 'setPlugin') {
        this._pluginKey = e.data.pluginKey ?? this._pluginKey;
        this._instanceId = e.data.instanceId ?? this._instanceId;
      }
    };
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    _parameters: Record<string, Float32Array>
  ): boolean {
    const input = inputs[0];
    const output = outputs[0];

    if (!input || !output) return true;

    const inL = input[0];
    const inR = input[1] ?? inL;
    const outL = output[0];
    const outR = output[1] ?? output[0];

    if (!inL || !outL) return true;

    const numSamples = inL.length; // típicamente 128

    // Bypass: passthrough
    if (this._bypass || !this._pluginKey || !this._instanceId) {
      outL.set(inL);
      if (outR && inR) outR.set(inR);
      return true;
    }

    // Si hay salida pendiente del IPC anterior, usarla
    if (this._pendingOutL && this._pendingOutR) {
      const remaining = this._pendingOutL.length - this._pendingOffset;
      const toCopy = Math.min(remaining, numSamples);

      for (let i = 0; i < toCopy; i++) {
        outL[i] = this._pendingOutL[this._pendingOffset + i];
        if (outR) outR[i] = this._pendingOutR[this._pendingOffset + i];
      }

      // Rellenar con input si no hay suficiente salida
      for (let i = toCopy; i < numSamples; i++) {
        outL[i] = inL[i];
        if (outR) outR[i] = inR[i];
      }

      this._pendingOffset += toCopy;
      if (this._pendingOffset >= this._pendingOutL.length) {
        this._pendingOutL = null;
        this._pendingOutR = null;
        this._pendingOffset = 0;
      }
    } else {
      // Sin salida pendiente: passthrough
      outL.set(inL);
      if (outR && inR) outR.set(inR);
    }

    // Pedir nuevo bloque al main thread (throttled)
    this._requestThrottle++;
    if (this._requestThrottle >= Vst3InsertProcessor.THROTTLE_INTERVAL) {
      this._requestThrottle = 0;
      this.port.postMessage({
        type: 'needProcess',
        pluginKey: this._pluginKey,
        instanceId: this._instanceId,
        inputL: Array.from(inL),
        inputR: Array.from(inR),
        numSamples,
      });
    }

    return true;
  }
}

registerProcessor(VST3_INSERT_PROCESSOR_NAME, Vst3InsertProcessor);