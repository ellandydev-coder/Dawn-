// src/app/config/appConfig.ts

/**
 * Configuración global de la aplicación DAWN
 */
export const appConfig = {
  // ══════════════════════════════════════════════════════════════
  // 🎬 SPLASH SCREEN
  // ══════════════════════════════════════════════════════════════

  /** Duración mínima del splash en milisegundos */
  splashMinDuration: 2500,

  /**
   * Si true: siempre espera splashMinDuration (duración fija)
   * Si false: solo espera si el motor cargó antes (duración mínima)
   */
  splashFixedDuration: false,

  // ══════════════════════════════════════════════════════════════
  // 🎛️ AUDIO ENGINE
  // ══════════════════════════════════════════════════════════════

  /** Sample rate por defecto (se actualiza al init real) */
  defaultSampleRate: 44100,

  // ══════════════════════════════════════════════════════════════
  // 🖥️ UI
  // ══════════════════════════════════════════════════════════════

  /** Mostrar panel de debug por defecto */
  showDebugByDefault: false,
};