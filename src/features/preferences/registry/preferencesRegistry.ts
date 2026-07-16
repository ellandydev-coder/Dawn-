// src/features/preferences/registry/preferencesRegistry.ts

import { createRegistry } from '@shared/registry/createRegistry';
import { sortByOrder } from '@shared/registry/registry.utils';
import type { PreferencePanelEntry } from './preferences.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 REGISTRY SINGLETON
// ═══════════════════════════════════════════════════════════════

/**
 * Registry de panels de Preferences.
 *
 * Contenido descubierto automáticamente via `bootstrap.ts` (Vite
 * glob eager sobre `../panels/[dir]/index.ts`).
 *
 * Reglas:
 *   • Ordenado por campo `order` (menor primero). Entries sin
 *     `order` van al final (según orden de descubrimiento).
 *   • Valida que `label` no esté vacío al registrar.
 *   • Warnings en dev por duplicados / validación fallida.
 *
 * NO se llama `register()` manualmente desde ninguna feature.
 * Los panels se auto-registran creando su carpeta bajo
 * `src/features/preferences/panels/[dir]/index.ts` con el
 * export `registration`.
 */
export const preferencesRegistry = createRegistry<PreferencePanelEntry>({
  name: 'preferences.panels',

  sortBy: sortByOrder<PreferencePanelEntry>(),

  validate(entry) {
    if (!entry.label || entry.label.trim().length === 0) {
      return 'label is required and cannot be empty';
    }
    if (entry.parentId && entry.parentId === entry.id) {
      return `parentId cannot equal id ("${entry.id}") — self-reference not allowed`;
    }
    return null;
  },
});