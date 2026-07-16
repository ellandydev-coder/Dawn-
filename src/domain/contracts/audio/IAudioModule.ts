// src/domain/contracts/audio/IAudioModule.ts

import type { IPluginManifest } from '../plugins/IPluginManifest';
import type {
  IParamDescriptor,
  IPluginPreset,
  AudioModuleListener,
} from './audio.types';

/**
 * IAudioModule
 * ------------
 * Contrato base que cumplen TODOS los módulos de audio (sources, effects,
 * recorders). Encapsula:
 *
 * - Identidad (id + manifest)
 * - Parámetros (descriptores + get/set + automation)
 * - Presets (guardar/cargar estado)
 * - Bypass (activar/desactivar el módulo sin quitarlo del grafo)
 * - Eventos (suscribirse a cambios)
 * - Ciclo de vida (dispose)
 *
 * NO define input/output de audio: eso lo agregan las interfaces hijas
 * (`IAudioSource`, `IAudioEffect`, `IAudioRecorder`).
 *
 * Este contrato es la unidad mínima que el sistema de plugins conoce.
 */
export interface IAudioModule {
  /** ID único de la instancia (no del tipo — dos reverbs distintos tienen IDs distintos) */
  readonly id: string;

  /** Manifest del plugin/módulo (metadata declarativa) */
  readonly manifest: IPluginManifest;

  // ─────────────────────────────────────
  // Parámetros
  // ─────────────────────────────────────

  /** Devuelve la lista de descriptores de parámetros expuestos */
  getParamDescriptors(): readonly IParamDescriptor[];

  /** Devuelve el valor actual de un parámetro */
  getParam(paramId: string): number;

  /** Cambia el valor de un parámetro. Debería aplicar fade suave si es continuo. */
  setParam(paramId: string, value: number): void;

  // ─────────────────────────────────────
  // Presets
  // ─────────────────────────────────────

  /** Serializa el estado actual como preset */
  savePreset(name: string): IPluginPreset;

  /** Carga un preset (aplica todos sus valores) */
  loadPreset(preset: IPluginPreset): void;

  // ─────────────────────────────────────
  // Bypass
  // ─────────────────────────────────────

  /** true si el módulo está bypassed (input pasa directo al output) */
  isBypassed(): boolean;

  /** Activa/desactiva el bypass */
  setBypassed(bypassed: boolean): void;

  // ─────────────────────────────────────
  // Eventos
  // ─────────────────────────────────────

  /**
   * Suscribe a eventos del módulo (cambio de parámetros, bypass, errores).
   * @returns función para desuscribirse
   */
  on(listener: AudioModuleListener): () => void;

  // ─────────────────────────────────────
  // Ciclo de vida
  // ─────────────────────────────────────

  /** true si el módulo ya fue disposed */
  readonly isDisposed: boolean;

  /**
   * Libera recursos. Después de dispose(), toda llamada al módulo
   * debe fallar de forma controlada (throw o no-op).
   */
  dispose(): void;
}