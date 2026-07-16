// src/domain/models/preferences/VstPreferences.ts

import { z } from 'zod';

// ═══════════════════════════════════════════════════════════════
// 🎯 SCHEMA
// ═══════════════════════════════════════════════════════════════

/**
 * Opciones del dropdown "Parameter automation notifications".
 * Determinan cómo se envían notificaciones de automation a los plugins.
 */
export const VST_AUTOMATION_NOTIFICATION_MODES = [
  'always',
  'ignore-when-closed',
  'never',
] as const;

export type VstAutomationNotificationMode =
  (typeof VST_AUTOMATION_NOTIFICATION_MODES)[number];

/**
 * Opciones del dropdown "Knob mode" (comportamiento de los knobs del plugin).
 */
export const VST_KNOB_MODES = [
  'default',
  'linear',
  'circular',
  'relative-circular',
] as const;

export type VstKnobMode = (typeof VST_KNOB_MODES)[number];

// ═══════════════════════════════════════════════════════════════
// 🎯 SCHEMA COMPLETO
// ═══════════════════════════════════════════════════════════════

/**
 * Preferencias del panel VST (Preferences → Plug-ins → VST).
 *
 * Todas las settings están agrupadas en 2 secciones lógicas:
 *   1. Paths & escaneo (rutas + comportamiento al arrancar)
 *   2. UI del plugin (generic UI, knob mode)
 *   3. Compatibility (flags avanzados)
 */
export const VstPreferencesSchema = z.object({
  // ─── Paths y escaneo ────────────────────────────────────
  /**
   * Rutas donde se escanean plugins VST3.
   * Múltiples rutas separadas por punto y coma.
   * Ejemplo: "C:\\Program Files\\VstPlugins;C:\\Common\\VST3"
   */
  pluginPaths: z.string().default(''),

  /** Escanear plugins nuevos/actualizados automáticamente al arrancar */
  scanOnStartup: z.boolean().default(true),

  // ─── UI del plugin ──────────────────────────────────────
  /** Usar UI genérica en vez de la UI propia del plugin */
  useGenericUi: z.boolean().default(false),

  /** Comportamiento de los knobs del plugin */
  knobMode: z
    .enum(VST_KNOB_MODES as unknown as [VstKnobMode, ...VstKnobMode[]])
    .default('default'),

  // ─── Compatibility ──────────────────────────────────────
  /** Cuándo enviar notificaciones de automation a los plugins */
  automationNotifications: z
    .enum(
      VST_AUTOMATION_NOTIFICATION_MODES as unknown as [
        VstAutomationNotificationMode,
        ...VstAutomationNotificationMode[],
      ]
    )
    .default('ignore-when-closed'),

  /** No hacer flush a synthesizer plug-ins en stop/reset */
  dontFlushSynthesizers: z.boolean().default(false),

  /** No enviar note-offs ni pitch reset en stop/reset */
  dontSendNoteOffs: z.boolean().default(false),

  /** Informar a los plugins del estado de renderizado offline */
  informOfflineRendering: z.boolean().default(true),

  /** Bypassear audio mientras se abre la ventana de config del plugin */
  bypassOnConfigOpen: z.boolean().default(false),

  /** Modo síncrono para plugins UAD-1 (reduce CPU munch, requiere anticipative FX off) */
  uad1SyncMode: z.boolean().default(false),

  /** Permitir descarga completa de plugins VST (reduce memoria, puede no ser compatible) */
  allowCompleteUnload: z.boolean().default(false),
});

export type VstPreferences = z.infer<typeof VstPreferencesSchema>;

// ═══════════════════════════════════════════════════════════════
// 🎯 DEFAULTS
// ═══════════════════════════════════════════════════════════════

/**
 * Valores por defecto derivados del schema.
 * Fuente única de verdad para el estado inicial.
 */
export function createDefaultVstPreferences(): VstPreferences {
  return VstPreferencesSchema.parse({});
}

// ═══════════════════════════════════════════════════════════════
// 🎯 LABELS PARA UI
// ═══════════════════════════════════════════════════════════════

/**
 * Etiquetas legibles para las opciones del dropdown "Automation notifications".
 * Se usan en el <PrefSelect> del panel VST.
 */
export const AUTOMATION_NOTIFICATION_LABELS: Record<
  VstAutomationNotificationMode,
  string
> = {
  always: 'Always send automation notifications',
  'ignore-when-closed': 'Ignore when plug-in window is not open (default)',
  never: 'Never send automation notifications',
};

/**
 * Etiquetas legibles para las opciones del dropdown "Knob mode".
 */
export const KNOB_MODE_LABELS: Record<VstKnobMode, string> = {
  default: 'Default',
  linear: 'Linear',
  circular: 'Circular',
  'relative-circular': 'Relative Circular',
};