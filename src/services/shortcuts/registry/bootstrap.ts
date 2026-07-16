// src/services/shortcuts/registry/bootstrap.ts

import { loadFromGlob } from '@shared/registry/createRegistry';
import type { GlobModule } from '@shared/registry/registry.types';
import { shortcutManager } from '../ShortcutManager';
import { shortcutsRegistry } from './shortcutsRegistry';
import type {
  ShortcutRegistration,
  ShortcutCtx,
  TypedStore,
} from './shortcuts.types';

// ═══════════════════════════════════════════════════════════════
// GLOB - descubre features/*/shortcuts.ts automaticamente
// ═══════════════════════════════════════════════════════════════

const modules = import.meta.glob<GlobModule<ShortcutRegistration>>(
  '../../../features/*/shortcuts.ts',
  { eager: true }
);

// ═══════════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════════

/**
 * Bootstrap del sistema de shortcuts distribuido.
 *
 * 1. Limpia el registry (importante en React StrictMode DEV)
 * 2. Descubre todos los features/[nombre]/shortcuts.ts via glob
 * 3. Registra los extras pasados manualmente (ej: app/config/shortcuts.ts)
 * 4. Construye todos los shortcuts con el ctx (dispatch + getState)
 * 5. Los registra en el ShortcutManager global
 *
 * @param store   - Store tipado (necesario para el ctx)
 * @param extras  - Registrations adicionales fuera del glob (cross-feature)
 * @returns Funcion de cleanup que desregistra todos los shortcuts
 */
export function bootstrapShortcuts(
  store: TypedStore,
  extras: readonly ShortcutRegistration[] = []
): () => void {
  // React.StrictMode en DEV monta/desmonta y vuelve a montar efectos.
  // El ShortcutManager ya se limpia en el return del useEffect, pero el
  // registry vive como singleton de modulo. Lo vaciamos aqui para evitar
  // logs de Duplicate id y dejar el bootstrap idempotente.
  shortcutsRegistry.clear();

  // 1. Cargar features al registry via glob
  const discoveredCount = loadFromGlob(shortcutsRegistry, modules);

  // 2. Registrar extras manualmente (no los captura el glob)
  for (const extra of extras) {
    shortcutsRegistry.register(extra);
  }

  // 3. Construir ctx
  const ctx: ShortcutCtx = {
    dispatch: store.dispatch,
    getState: store.getState,
  };

  // 4. Aplanar todos los shortcuts de todos los grupos
  const allShortcuts = shortcutsRegistry
    .getAll()
    .flatMap((group) => group.build(ctx));

  // 5. Registrar en ShortcutManager
  const unregisters = allShortcuts.map((shortcut) =>
    shortcutManager.register({
      ...shortcut,
      context: 'global',
    })
  );

  if (import.meta.env.DEV) {
    const groupCount = shortcutsRegistry.getAll().length;
    console.info(
      `%c[Shortcuts] Listos: ${allShortcuts.length} atajos de ${groupCount} grupos (${discoveredCount} features + ${extras.length} extras)`,
      'color:#4ade80;font-weight:bold'
    );
  }

  // 6. Cleanup
  return () => {
    unregisters.forEach((unregister) => unregister());
  };
}