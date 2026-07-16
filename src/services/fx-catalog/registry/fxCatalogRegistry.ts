// src/services/fx-catalog/registry/fxCatalogRegistry.ts

import { createRegistry } from '@shared/registry/createRegistry';
import type { FxPluginRegistration } from './fxCatalog.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 REGISTRY DE PLUGINS FX
// ═══════════════════════════════════════════════════════════════

/**
 * Registry de plugins FX descubiertos.
 *
 * Se auto-pobla via Vite glob eager sobre `../plugins/*​/*.ts` en el
 * bootstrap. Cada archivo bajo `plugins/[categoria]/[NombrePlugin].ts`
 * debe exportar `registration: FxPluginRegistration`.
 *
 * Este registry alimenta al `FxCatalog` singleton — los consumidores
 * (useFxBrowser, etc.) siguen usando `FxCatalog.getAll()` sin cambios.
 *
 * Validaciones al registrar:
 *   • id único (default de createRegistry)
 *   • name no vacío
 *   • vendor no vacío
 *   • category presente
 *   • format presente
 */
export const fxCatalogRegistry = createRegistry<FxPluginRegistration>({
  name: 'fx-catalog',

  validate(entry) {
    if (!entry.name || entry.name.trim() === '') {
      return `plugin "${entry.id}" must have a non-empty name`;
    }
    if (!entry.vendor || entry.vendor.trim() === '') {
      return `plugin "${entry.id}" must have a non-empty vendor`;
    }
    if (!entry.category) {
      return `plugin "${entry.id}" must have a category`;
    }
    if (!entry.format) {
      return `plugin "${entry.id}" must have a format`;
    }
    return null;
  },
});