// src/services/shortcuts/registry/shortcutsRegistry.ts

import { createRegistry } from '@shared/registry/createRegistry';
import type { ShortcutRegistration } from './shortcuts.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 REGISTRY PRINCIPAL DE GRUPOS DE SHORTCUTS
// ═══════════════════════════════════════════════════════════════

/**
 * Registry principal de grupos de shortcuts.
 *
 * Cada entry representa un grupo (feature) que aporta uno o más
 * shortcuts al sistema global. Se auto-poblan via Vite glob eager
 * sobre `../../../features/[nombre]/shortcuts.ts` en el bootstrap.
 *
 * Validaciones al registrar:
 *   • id único (default de createRegistry)
 *   • label no vacío
 *   • build es una función
 *
 * ─── ACCESO ───
 * Este registry solo contiene METADATOS de los grupos.
 * Los shortcuts individuales se construyen en el bootstrap
 * llamando a `entry.build(ctx)` y se registran en el
 * ShortcutManager global (no en este registry).
 */
export const shortcutsRegistry = createRegistry<ShortcutRegistration>({
  name: 'shortcuts.groups',

  validate(entry) {
    if (!entry.label || entry.label.trim() === '') {
      return `group "${entry.id}" must have a non-empty label`;
    }
    if (typeof entry.build !== 'function') {
      return `group "${entry.id}" must expose a build(ctx) function`;
    }
    return null;
  },
});