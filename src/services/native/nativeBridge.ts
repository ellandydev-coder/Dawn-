// src/services/native/nativeBridge.ts

import { invoke } from '@tauri-apps/api/core';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS (espejo de los structs de Rust)
// ═══════════════════════════════════════════════════════════════

/**
 * Plugin escaneado por Rust — espejo de `ScannedPlugin` en `src-tauri/src/plugins.rs`.
 *
 * ⚠️  Los tipos deben mantenerse SINCRONIZADOS entre Rust y TypeScript.
 * Si cambias uno, cambia el otro.
 *
 * Convierte a `ScannedPlugin` del scanner via `pluginScanner.thunks.ts`.
 */
export interface NativeScannedPlugin {
  id: string;
  name: string;
  vendor: string;
  category: string;
  format: string;
  version: string;
  path: string;
  available: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 BRIDGE
// ═══════════════════════════════════════════════════════════════

/**
 * Puente hacia la lógica nativa (Rust + C++).
 * Todas las llamadas a código nativo deben pasar por aquí.
 * Así los componentes/hooks/servicios NO dependen directamente de Tauri.
 */
export const nativeBridge = {
  // ===== Utilidades de prueba (FFI a C++) =====

  sumar: (a: number, b: number): Promise<number> =>
    invoke<number>('sumar', { a, b }),

  saludar: (nombre: string): Promise<string> =>
    invoke<string>('saludar', { nombre }),

  // ===== Plugin scanning (Rust puro) =====

  /**
   * Escanea rutas del filesystem buscando plugins VST3.
   *
   * @param paths - Rutas absolutas a escanear. Si array vacío,
   *                Rust usa las rutas por defecto del OS.
   * @returns Lista de plugins encontrados con metadatos básicos
   *          (name + path). Vendor/category/version son placeholders
   *          en esta versión — Hito C añadirá parsing real del VST3 SDK.
   */
  scanVstPlugins: (paths: string[]): Promise<NativeScannedPlugin[]> =>
    invoke<NativeScannedPlugin[]>('scan_vst_plugins', { paths }),

  // ===== A futuro: DSP, análisis, render, etc. =====
  // processFFT: (buffer: Float32Array) => invoke<Float32Array>('process_fft', { buffer }),
  // generateWaveform: (samples: Float32Array, width: number) =>
  //   invoke<Float32Array>('generate_waveform', { samples, width }),
};

/**
 * Detecta si estamos corriendo dentro de Tauri (ventana nativa)
 * o en un navegador normal (dev sin Tauri).
 */
export const isTauriEnv = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;