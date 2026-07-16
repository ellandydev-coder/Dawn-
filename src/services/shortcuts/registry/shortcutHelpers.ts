// src/services/shortcuts/registry/shortcutHelpers.ts

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS COMPARTIDOS DEL SISTEMA DE SHORTCUTS
// ═══════════════════════════════════════════════════════════════

/**
 * Placeholder tipado para shortcuts pendientes de conectar.
 * Aparece en consola con warning claro.
 *
 * @example
 * ```ts
 * handler: pending('Guardar proyecto')
 * ```
 */
export function pending(feature: string): () => void {
  return () => {
    console.warn(`[Shortcut] "${feature}" aún no está conectado (TODO)`);
  };
}