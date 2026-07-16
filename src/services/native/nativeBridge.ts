import { invoke } from '@tauri-apps/api/core';

/**
 * Puente hacia la lógica nativa (Rust + C++).
 * Todas las llamadas a código C++ deben pasar por aquí.
 * Así los componentes/hooks/servicios NO dependen directamente de Tauri.
 */
export const nativeBridge = {
  // ===== Utilidades de prueba =====
  sumar: (a: number, b: number): Promise<number> =>
    invoke<number>('sumar', { a, b }),

  saludar: (nombre: string): Promise<string> =>
    invoke<string>('saludar', { nombre }),

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