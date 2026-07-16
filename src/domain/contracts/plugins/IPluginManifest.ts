// src/domain/contracts/plugins/IPluginManifest.ts

/**
 * IPluginManifest
 * ---------------
 * Metadata mínima que TODO módulo/plugin de audio debe declarar.
 *
 * Este contrato es agnóstico:
 * - Sirve para módulos internos de DAWN (SamplePlayer, etc.)
 * - Sirve para plugins de terceros (JS, WASM, VST3 futuro)
 * - Sirve para scripts de usuario (ReaScript-style)
 *
 * Vive en `domain/` porque NO depende de Web Audio ni de React.
 */

export type PluginKind = 'source' | 'effect' | 'recorder';

export type PluginBackend =
  | 'js'       // implementación JavaScript pura (Web Audio nodes)
  | 'wasm'     // AudioWorklet + WebAssembly (Rust/C++/Zig)
  | 'native'   // proceso/binario nativo vía Tauri IPC
  | 'vst3'     // VST3 hosteado (futuro)
  | 'clap'     // CLAP hosteado (futuro)
  | 'au';      // AudioUnit hosteado (futuro, macOS)

export interface IPluginAuthor {
  readonly name: string;
  readonly url?: string;
  readonly email?: string;
}

export interface IPluginManifest {
  /** ID único, formato "vendor.plugin-name" recomendado */
  readonly id: string;

  /** Nombre visible en la UI */
  readonly name: string;

  /** Versión semver "1.0.0" */
  readonly version: string;

  /** Tipo de módulo */
  readonly kind: PluginKind;

  /** Backend de implementación */
  readonly backend: PluginBackend;

  /** Descripción corta para tooltips / listados */
  readonly description?: string;

  /** Autor(es) del plugin */
  readonly author?: IPluginAuthor;

  /** URL de documentación / sitio del plugin */
  readonly homepage?: string;

  /** Categorías/tags para filtrar ("reverb", "vocal", "drum", etc.) */
  readonly tags?: readonly string[];

  /** Latencia declarada en muestras (para PDC futuro) */
  readonly latencySamples?: number;

  /** true si el plugin necesita sidechain input */
  readonly hasSidechain?: boolean;

  /** true si el plugin es MIDI-only (no procesa audio) */
  readonly isMidiOnly?: boolean;
}