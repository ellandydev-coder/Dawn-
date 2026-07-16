/**
 * MeterProcessor
 * --------------
 * AudioWorklet que analiza el audio que pasa por él y calcula:
 *   - PEAK: valor máximo absoluto (para detectar clipping)
 *   - RMS:  volumen percibido promedio (más "natural")
 *
 * Envía los datos al hilo principal vía postMessage cada ~16ms (60 FPS).
 *
 * ⚠️ IMPORTANTE:
 * Este archivo se compila como worklet, NO como módulo normal.
 * No puede importar nada de fuera. Todo debe estar autocontenido.
 */

// ================================================================
// Declaraciones globales del AudioWorklet scope
// (TypeScript no las conoce por defecto)
// ================================================================
declare const sampleRate: number;

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor(options?: AudioWorkletNodeOptions);
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>
  ): boolean;
}

declare function registerProcessor(
  name: string,
  processor: new (options?: AudioWorkletNodeOptions) => AudioWorkletProcessor
): void;

// ================================================================
// Tipos del mensaje que enviamos al hilo principal
// ================================================================
interface MeterMessage {
  type: 'meter';
  peak: number;
  rms: number;
  channels: number;
}

// ================================================================
// Processor
// ================================================================
class MeterProcessor extends AudioWorkletProcessor {
  private _samplesUntilPost = 0;
  private readonly _postInterval: number;

  private _sumSquares = 0;
  private _sampleCount = 0;
  private _currentPeak = 0;

  constructor() {
    super();
    // 60 FPS → cada 16.6ms → a 48kHz son ~800 samples
    this._postInterval = Math.floor(sampleRate / 60);
    this._samplesUntilPost = this._postInterval;
  }

  process(inputs: Float32Array[][]): boolean {
    const input = inputs[0];

    // Si no hay input (silencio total), reportamos 0
    if (!input || input.length === 0) {
      this._maybePostMeter(0, 0, 1);
      return true;
    }

    const numChannels = input.length;
    const numSamples = input[0]?.length ?? 0;

    for (let i = 0; i < numSamples; i++) {
      let sampleSum = 0;
      let sampleMax = 0;

      for (let ch = 0; ch < numChannels; ch++) {
        const sample = input[ch]?.[i] ?? 0;
        const absSample = Math.abs(sample);

        if (absSample > sampleMax) sampleMax = absSample;
        sampleSum += sample * sample;
      }

      if (sampleMax > this._currentPeak) {
        this._currentPeak = sampleMax;
      }

      this._sumSquares += sampleSum / numChannels;
      this._sampleCount++;
    }

    this._samplesUntilPost -= numSamples;

    if (this._samplesUntilPost <= 0) {
      const rms =
        this._sampleCount > 0
          ? Math.sqrt(this._sumSquares / this._sampleCount)
          : 0;

      this._maybePostMeter(this._currentPeak, rms, numChannels);

      this._sumSquares = 0;
      this._sampleCount = 0;
      this._currentPeak = 0;
      this._samplesUntilPost = this._postInterval;
    }

    return true;
  }

  private _maybePostMeter(peak: number, rms: number, channels: number): void {
    const msg: MeterMessage = { type: 'meter', peak, rms, channels };
    this.port.postMessage(msg);
  }
}

registerProcessor('meter-processor', MeterProcessor);

// TypeScript necesita esto para tratar el archivo como módulo
export {};