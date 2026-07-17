// src/domain/models/FxPluginInfo.ts

import { z } from 'zod';
import {
  FX_PLUGIN_CATEGORIES,
  type FxPluginCategory,
} from '@domain/enums/FxPluginCategory';
import {
  FX_PLUGIN_FORMATS,
  type FxPluginFormat,
} from '@domain/enums/FxPluginFormat';

// ═══════════════════════════════════════════════════════════════
// 🎯 SCHEMA
// ═══════════════════════════════════════════════════════════════

/**
 * Metadatos de un plugin FX disponible en el catálogo.
 *
 * NO representa una instancia activa (eso lo maneja el EffectChain).
 * Esto es solo información descriptiva mostrada en el FX Browser.
 */
export const FxPluginInfoSchema = z.object({
  /** ID único del plugin (ej: "built-in.reaeq") */
  id: z.string().min(1),

  /** Nombre visible (ej: "ReaEQ") */
  name: z.string().min(1),

  /** Fabricante/vendor (ej: "Cockos", "DAWN") */
  vendor: z.string().min(1),

  /** Categoría principal */
  category: z.enum(FX_PLUGIN_CATEGORIES as unknown as [string, ...string[]]),

  /** Formato técnico */
  format: z.enum(FX_PLUGIN_FORMATS as unknown as [string, ...string[]]),

  /** Descripción larga (para tooltip / preview) */
  description: z.string().default(''),

  /** Versión semver (opcional) */
  version: z.string().optional(),

  /** true si el plugin está disponible para usar (false = grayed out) */
  available: z.boolean().default(true),

  /**
   * Ruta absoluta al bundle del plugin en disco.
   *
   * Solo presente para plugins escaneados del filesystem (VST3, VST, CLAP…).
   * Los built-in y WASM NO la tienen porque viajan dentro del bundle
   * de la aplicación.
   *
   * Necesaria para invocar `vst3Bridge.loadPlugin(bundlePath)` cuando
   * el usuario añade un VST3 escaneado a una track.
   */
  sourcePath: z.string().optional(),
});

export type FxPluginInfo = Omit<
  z.infer<typeof FxPluginInfoSchema>,
  'category' | 'format'
> & {
  category: FxPluginCategory;
  format: FxPluginFormat;
};