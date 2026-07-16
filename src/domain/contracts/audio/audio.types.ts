// src/domain/contracts/audio/audio.types.ts

/**
 * Tipos compartidos por todos los contratos de audio.
 *
 * NO importa Web Audio: estos tipos son puros y sirven tanto para
 * módulos JS como para plugins nativos/WASM.
 */

/** Escala de un parámetro (afecta cómo se dibuja el knob/fader) */
export type ParamScale = 'linear' | 'log' | 'exp';

/** Unidad de un parámetro (para mostrar en la UI) */
export type ParamUnit =
  | 'none'
  | 'db'
  | 'hz'
  | 'khz'
  | 'ms'
  | 's'
  | 'percent'
  | 'semitones'
  | 'cents'
  | 'ratio'
  | 'samples';

/**
 * Descriptor de un parámetro controlable por el usuario o por automation.
 * El plugin declara la lista de sus parámetros vía `getParamDescriptors()`.
 */
export interface IParamDescriptor {
  /** ID único dentro del plugin */
  readonly id: string;

  /** Nombre visible */
  readonly name: string;

  /** Valor mínimo */
  readonly min: number;

  /** Valor máximo */
  readonly max: number;

  /** Valor por defecto */
  readonly defaultValue: number;

  /** Cómo se mapea 0..1 (UI) al rango real */
  readonly scale: ParamScale;

  /** Unidad para mostrar */
  readonly unit: ParamUnit;

  /** Paso mínimo (para snap del knob). undefined = continuo */
  readonly step?: number;

  /** true si acepta automation */
  readonly automatable?: boolean;

  /** true si el parámetro es solo-lectura (meter, GR, etc.) */
  readonly readOnly?: boolean;

  /** Descripción larga para tooltips */
  readonly description?: string;
}

/**
 * Preset serializable de un plugin.
 * Cada plugin decide qué guarda en `data`.
 */
export interface IPluginPreset {
  readonly id: string;
  readonly name: string;
  readonly pluginId: string;
  /** Payload libre — el plugin lo interpreta */
  readonly data: Readonly<Record<string, unknown>>;
}

/** Estado de bypass */
export type BypassState = 'active' | 'bypassed';

/** Eventos comunes que cualquier módulo puede emitir */
export type AudioModuleEvent =
  | { type: 'paramChanged'; paramId: string; value: number }
  | { type: 'bypassChanged'; bypassed: boolean }
  | { type: 'presetLoaded'; presetId: string }
  | { type: 'error'; error: Error }
  | { type: 'disposed' };

export type AudioModuleListener = (event: AudioModuleEvent) => void;