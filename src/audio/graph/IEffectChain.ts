// src/audio/graph/IEffectChain.ts

export interface IEffectChain {
  /** Nodo de entrada donde se conecta la señal pre-FX */
  readonly inputNode: AudioNode;

  /** Nodo de salida donde sale la señal post-FX */
  readonly outputNode: AudioNode;

  /** Latencia total de la cadena en muestras (para PDC futuro) */
  getLatencySamples?(): number;

  /** Bypass interno de la cadena */
  setBypassed?(bypassed: boolean): void;

  dispose(): void;
}