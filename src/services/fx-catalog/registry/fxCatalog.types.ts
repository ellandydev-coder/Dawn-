// src/services/fx-catalog/registry/fxCatalog.types.ts

import type { RegistryEntry } from '@shared/registry/registry.types';
import type { FxPluginInfo } from '@domain/models/FxPluginInfo';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/**
 * Registration de un plugin FX en el catálogo.
 *
 * Es una extensión de `FxPluginInfo` (el modelo de dominio) más
 * el requisito de `id` obligatorio (por `RegistryEntry`).
 *
 * En la práctica es idéntico a `FxPluginInfo` — solo cambia el
 * ergonomic wrapper para el registry.
 *
 * ─── EJEMPLO ───
 * ```ts
 * // services/fx-catalog/plugins/eq/ReaEQ.ts
 * import type { FxPluginRegistration } from '../../registry';
 *
 * export const registration: FxPluginRegistration = {
 *   id: 'built-in.reaeq',
 *   name: 'ReaEQ',
 *   vendor: 'DAWN',
 *   category: 'eq',
 *   format: 'built-in',
 *   description: 'Parametric equalizer with unlimited bands',
 *   version: '1.0.0',
 *   available: true,
 * };
 * ```
 *
 * ─── CONVENCIÓN ───
 *   • id: `built-in.<nombre-lowercase>` para plugins nativos
 *   • id: `<vendor>.<nombre>` para plugins de terceros
 */
export interface FxPluginRegistration extends RegistryEntry, FxPluginInfo {
  readonly id: string;
}