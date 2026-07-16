/**
 * RecorderProcessor
 * -----------------
 * AudioWorklet que captura los samples que pasan por él y los envía
 * al hilo principal para acumularlos en un buffer de grabación.
 *
 * Diseño:
 * - Empieza SUSPENDIDO. Solo captura cuando recibe { type: 'start' }.
 * - Cada bloque procesado (128 samples) se copia y se envía por port.
 * - El hilo principal (MicRecorder) los acumula en un array.
 * - { type: 'stop' } deja de capturar pero el processor sigue vivo.
 *
 * ⚠️ IMPORTANTE:
 * Este archivo se compila como worklet, NO como módulo normal.
 * No puede importar nada de fuera. Todo debe estar autocontenido.
 */

// ================================================================
// Declaraciones globales del AudioWorklet scope
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
// Tipos de mensajes
// ================================================================

/** Comandos que el hilo principal envía al processor */
type RecorderCommand =
  | { type: 'start' }
  | { type: 'stop' };

/** Mensajes que el processor envía al hilo principal */
interface RecorderSamplesMessage {
  type: 'samples';
  /** Un Float32Array por canal (copia independiente, transferible) */
  channels: Float32Array[];
  /** Número de sample absoluto en el que empieza este bloque */
  sampleOffset: number;
  /** Sample rate del contexto (para reconstruir el AudioBuffer) */
  sampleRate: number;
}

interface RecorderStartedMessage {
  type: 'started';
  sampleRate: number;
  startSample: number;
}

interface RecorderStoppedMessage {
  type: 'stopped';
  totalSamples: number;
}

// ================================================================
// Processor
// ================================================================
class RecorderProcessor extends AudioWorkletProcessor {
  private _isRecording = false;
  private _totalSamples = 0;

  constructor() {
    super();
    this.port.onmessage = this._handleCommand.bind(this);
  }

  private _handleCommand(event: MessageEvent<RecorderCommand>): void {
    const cmd = event.data;
    if (!cmd || typeof cmd.type !== 'string') return;

    switch (cmd.type) {
      case 'start':
        this._isRecording = true;
        this._totalSamples = 0;
        const startedMsg: RecorderStartedMessage = {
          type: 'started',
          sampleRate,
          startSample: 0,
        };
        this.port.postMessage(startedMsg);
        break;

      case 'stop':
        this._isRecording = false;
        const stoppedMsg: RecorderStoppedMessage = {
          type: 'stopped',
          totalSamples: this._totalSamples,
        };
        this.port.postMessage(stoppedMsg);
        break;
    }
  }

  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][]
  ): boolean {
    const input = inputs[0];

    // Passthrough: input → output (para monitoring / meter downstream)
    const output = outputs[0];
    if (input && output) {
      const numChannels = Math.min(input.length, output.length);
      for (let ch = 0; ch < numChannels; ch++) {
        const inputCh = input[ch];
        const outputCh = output[ch];
        if (inputCh && outputCh) {
          outputCh.set(inputCh);
        }
      }
    }

    // Si no estamos grabando, no hacemos nada más
    if (!this._isRecording) return true;

    // Sin input real, no capturamos
    if (!input || input.length === 0) return true;

    const numChannels = input.length;
    const numSamples = input[0]?.length ?? 0;
    if (numSamples === 0) return true;

    // Copiar samples (importante: el buffer del input se reutiliza,
    // NO podemos guardar la referencia directa)
    const channelsCopy: Float32Array[] = new Array(numChannels);
    for (let ch = 0; ch < numChannels; ch++) {
      const src = input[ch];
      if (src) {
        // Copia via slice para poder transferir sin bloqueo
        channelsCopy[ch] = src.slice();
      } else {
        channelsCopy[ch] = new Float32Array(numSamples);
      }
    }

    const msg: RecorderSamplesMessage = {
      type: 'samples',
      channels: channelsCopy,
      sampleOffset: this._totalSamples,
      sampleRate,
    };

    // Transferir los ArrayBuffers para evitar copia adicional
    const transferList = channelsCopy.map((ch) => ch.buffer);
    this.port.postMessage(msg, transferList);

    this._totalSamples += numSamples;

    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);

// TypeScript necesita esto para tratar el archivo como módulo
export {};