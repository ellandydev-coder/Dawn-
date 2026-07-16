// src/domain/contracts/audio/IAudioRecorder.ts

import type { IAudioModule } from './IAudioModule';

/**
 * Estado del recorder.
 */
export type RecorderState =
  | 'idle'       // no armado
  | 'armed'      // armado, esperando start
  | 'recording'  // grabando
  | 'stopped';   // detenido, con material grabado

/**
 * Formato del resultado de una grabación.
 */
export interface IRecordingResult {
  /** ID único de la grabación (para asociar a un clip futuro) */
  readonly id: string;

  /** Audio grabado (multi-canal) */
  readonly buffer: AudioBuffer;

  /** Timestamp de audio (AudioContext.currentTime) al iniciar */
  readonly startedAt: number;

  /** Duración en segundos */
  readonly durationSec: number;

  /** Sample rate del buffer */
  readonly sampleRate: number;

  /** Número de canales */
  readonly channelCount: number;
}

/**
 * IAudioRecorder
 * --------------
 * Cualquier módulo que GRABA audio a un buffer (o archivo).
 *
 * Cubre:
 * - Grabación de micrófono (MediaStreamAudioSourceNode)
 * - Grabación de una línea de entrada (interfaz de audio)
 * - Bounce del master (renderizar mix a archivo)
 * - Loop recording (futuro: grabar en background con historial)
 * - Grabación desde cualquier AudioNode del grafo (útil para "record bus")
 *
 * Flujo típico:
 *   1. arm(source)        → recorder listo, escuchando input
 *   2. startRecording()   → empieza a acumular samples
 *   3. stopRecording()    → devuelve IRecordingResult
 *
 * Diseño REAPER-style:
 * - Monitor independiente del arm (`setMonitoring(true)`)
 * - Múltiples takes: cada `stopRecording()` devuelve un resultado nuevo
 * - Punch in/out (futuro): grabar solo en un rango del transporte
 */
export interface IAudioRecorder extends IAudioModule {
  /** Estado actual del recorder */
  readonly state: RecorderState;

  // ─────────────────────────────────────
  // Configuración de la fuente
  // ─────────────────────────────────────

  /**
   * Arma el recorder con un source de entrada.
   * @param source Cualquier AudioNode (típicamente un MediaStreamAudioSourceNode
   *               del mic, o un tap point del grafo).
   */
  arm(source: AudioNode): void;

  /** Desarma el recorder. Detiene monitoring y grabación si estaba activa. */
  disarm(): void;

  /** true si hay un source armado */
  isArmed(): boolean;

  // ─────────────────────────────────────
  // Monitoring
  // ─────────────────────────────────────

  /**
   * Habilita/deshabilita el monitoring (pasar el input al output para escucharlo).
   * Puede estar activo sin estar grabando.
   */
  setMonitoring(enabled: boolean): void;

  isMonitoring(): boolean;

  /**
   * Output del monitoring — se conecta al bus/master para escuchar el input.
   * Silencioso si monitoring está deshabilitado.
   */
  readonly monitorOutput: AudioNode;

  // ─────────────────────────────────────
  // Grabación
  // ─────────────────────────────────────

  /**
   * Inicia la grabación. Requiere que esté armed.
   * @param when Tiempo de audio en que arrancar. undefined = ahora.
   */
  startRecording(when?: number): void;

  /**
   * Detiene la grabación y devuelve el resultado.
   * @returns Promise porque el buffer puede necesitar conversión final.
   */
  stopRecording(): Promise<IRecordingResult>;

  /** true si está grabando activamente */
  isRecording(): boolean;

  // ─────────────────────────────────────
  // Métricas (opcional pero útil para UI)
  // ─────────────────────────────────────

  /** Duración actual de la grabación en curso, en segundos. 0 si no graba. */
  getCurrentDurationSec(): number;

  /** Nivel de entrada actual (peak) 0..1. Para meters de UI. */
  getInputLevel(): number;
}