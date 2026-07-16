// src/domain/models/FxPluginInstance.ts

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// 🎯 SCHEMA
// ═══════════════════════════════════════════════════════════════

/**
 * Instancia activa de un plugin FX dentro de una FxChain.
 *
 * ⚠️ NO confundir con `FxPluginInfo`:
 *   • `FxPluginInfo`     → metadatos del catálogo (definición)
 *   • `FxPluginInstance` → instancia real usada por una track
 *
 * Un mismo plugin puede tener N instancias (ej: 2 ReaEQ en la misma track).
 * Cada instancia tiene su propio estado (params, bypass, preset).
 */
export const FxPluginInstanceSchema = z.object({
  /** ID único de esta instancia (nanoid). Diferente al pluginId. */
  id: z.string().min(1),

  /** ID del plugin del catálogo (ej: "built-in.reaeq") */
  pluginId: z.string().min(1),

  /** Nombre visible en la chain (por defecto = nombre del plugin) */
  displayName: z.string().min(1),

  /** true = plugin activo, false = bypass (audio pasa sin procesar) */
  enabled: z.boolean().default(true),

  /**
   * Parámetros del plugin como key-value.
   * Cada plugin define sus keys en su `getParamDescriptors()`.
   * Ejemplo: { "freq": 1000, "gain": 0, "q": 1.4 }
   */
  params: z.record(z.string(), z.number()).default({}),

  /** ID del preset actual (null = no hay preset cargado) */
  presetId: z.string().nullable().default(null),

  /** Timestamp de cuando se añadió a la chain */
  addedAt: z.number().default(() => Date.now()),
});

export type FxPluginInstance = z.infer<typeof FxPluginInstanceSchema>;