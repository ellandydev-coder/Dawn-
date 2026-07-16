// src/domain/contracts/audio/IAudioEffect.ts

import type { IAudioModule } from './IAudioModule';

/**
 * IAudioEffect
 * ------------
 * Cualquier módulo que PROCESA audio (recibe input, produce output).
 *
 * Cubre:
 * - EQ, compresor, reverb, delay, saturación, etc.
 * - Efectos JS (Web Audio nodes directos)
 * - Efectos WASM (AudioWorklet + Rust/C++)
 * - Plugins hosteados (VST3, CLAP, AU) vía wrappers
 * - Utilidades (gate, ganancia con curva, mid/side, etc.)
 *
 * NO cubre:
 * - Sources (ver IAudioSource)
 * - Recorders (ver IAudioRecorder)
 *
 * Signal path esperado:
 *   input → [procesamiento interno] → output
 *
 * Nota Nivel 1: `input` y `output` son AudioNodes. Un plugin puede tener
 * un único AudioWorkletNode que sea a la vez input y output.
 *
 * Un IAudioEffect en bypass debe conectar `input` directamente a `output`
 * internamente para pasar la señal sin procesar (pero sin cambios de fase).
 */
export interface IAudioEffect extends IAudioModule {
  /** Nodo de entrada — el track/bus conecta aquí */
  readonly input: AudioNode;

  /** Nodo de salida — se conecta al siguiente efecto o al bus */
  readonly output: AudioNode;

  // ─────────────────────────────────────
  // Sidechain (opcional)
  // ─────────────────────────────────────

  /**
   * true si el efecto tiene entrada de sidechain.
   * Debe coincidir con manifest.hasSidechain.
   */
  readonly hasSidechain: boolean;

  /**
   * Nodo de sidechain input. Solo existe si `hasSidechain === true`.
   * El grafo enruta aquí la señal de sidechain (ej: kick → compresor de bajo).
   */
  readonly sidechainInput?: AudioNode;

  // ─────────────────────────────────────
  // Latencia (para PDC futuro)
  // ─────────────────────────────────────

  /**
   * Latencia interna del efecto en muestras.
   * Usada para Plugin Delay Compensation en el grafo.
   * 0 si el efecto es zero-latency.
   */
  getLatencySamples(): number;

  // ─────────────────────────────────────
  // Wet/Dry mix (opcional pero común)
  // ─────────────────────────────────────

  /**
   * true si el efecto expone un control wet/dry integrado.
   * false → el mix se hace vía trim externo.
   */
  readonly hasWetDryMix: boolean;

  /**
   * Wet 0..1. Solo tiene efecto si `hasWetDryMix === true`.
   * 0 = todo dry, 1 = todo wet.
   */
  setWetDry?(wet: number): void;

  getWetDry?(): number;
}