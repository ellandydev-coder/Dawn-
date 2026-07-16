// src/domain/enums/FxPluginFormat.ts

/**
 * Formatos de plugin FX soportados por DAWN.
 *
 * - `built-in`  → Plugins nativos del proyecto (TS + Web Audio)
 * - `wasm`      → WASM/AudioWorklet (Rust/C++/Zig compilado)
 * - `vst3`      → VST3 vía Tauri IPC (futuro)
 * - `vst`       → VST 2 legacy vía Tauri IPC (futuro)
 * - `js`        → JavaScript scripting estilo REAPER JSFX (futuro)
 */
export const FX_PLUGIN_FORMATS = [
  'built-in',
  'wasm',
  'vst3',
  'vst',
  'js',
] as const;

export type FxPluginFormat = (typeof FX_PLUGIN_FORMATS)[number];

/** Label visible en UI para cada formato */
export const FX_PLUGIN_FORMAT_LABELS: Record<FxPluginFormat, string> = {
  'built-in': 'Built-in',
  wasm: 'WASM',
  vst3: 'VST3',
  vst: 'VST',
  js: 'JS',
};