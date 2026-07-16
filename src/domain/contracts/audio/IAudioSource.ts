// src/domain/contracts/audio/IAudioSource.ts

import type { IAudioModule } from './IAudioModule';

/**
 * IAudioSource
 * ------------
 * Cualquier módulo que GENERA audio (no procesa audio previo).
 *
 * Cubre:
 * - SamplePlayer (reproduce audio buffers)
 * - Sintetizadores (osciladores, wavetable, FM, etc.)
 * - Generadores de ruido / test signals
 * - Grabaciones en reproducción
 * - Instrumentos MIDI (futuro)
 * - Plugins VST3i (futuro)
 *
 * NO cubre:
 * - Entrada de micrófono (eso es IAudioRecorder → produce buffers, no stream continuo)
 * - Efectos (necesitan input, ver IAudioEffect)
 *
 * Nota Nivel 1: `output` es un AudioNode de Web Audio. Un plugin nativo/WASM
 * expone su AudioWorkletNode aquí. Un plugin JS puro expone su nodo final.
 */
export interface IAudioSource extends IAudioModule {
  /** Nodo de salida — se conecta al grafo (típicamente al input de un track) */
  readonly output: AudioNode;

  /**
   * true si la source acepta eventos MIDI (notes on/off, CC).
   * Fuentes puramente audio (samplers de un solo shot) devuelven false.
   */
  readonly acceptsMidi: boolean;

  // ─────────────────────────────────────
  // Control de reproducción
  // ─────────────────────────────────────

  /**
   * Inicia la generación de audio.
   * @param when Tiempo de audio (AudioContext.currentTime) en que arrancar.
   *             undefined = ahora mismo.
   */
  start(when?: number): void;

  /**
   * Detiene la generación de audio.
   * @param when Tiempo de audio en que parar. undefined = ahora.
   */
  stop(when?: number): void;

  /** true si la source está sonando actualmente */
  isPlaying(): boolean;

  // ─────────────────────────────────────
  // MIDI (opcional)
  // ─────────────────────────────────────

  /**
   * Dispara una nota MIDI. Solo tiene efecto si `acceptsMidi === true`.
   * @param note MIDI note number 0..127
   * @param velocity 0..127
   * @param when Tiempo de audio. undefined = ahora.
   */
  noteOn?(note: number, velocity: number, when?: number): void;

  /**
   * Libera una nota MIDI. Solo tiene efecto si `acceptsMidi === true`.
   */
  noteOff?(note: number, when?: number): void;

  /**
   * Envía un Control Change MIDI.
   */
  controlChange?(cc: number, value: number, when?: number): void;
}