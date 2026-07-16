// src/services/fx-catalog/registry/bootstrap.ts

import { loadFromGlob } from '@shared/registry/createRegistry';
import type { GlobModule } from '@shared/registry/registry.types';
import { FxCatalog } from '../FxCatalog';
import { fxCatalogRegistry } from './fxCatalogRegistry';
import type { FxPluginRegistration } from './fxCatalog.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 GLOB — descubre plugins/[categoria]/*.ts automáticamente
// ═══════════════════════════════════════════════════════════════

/**
 * Un solo glob wildcard descubre TODOS los plugins bajo cualquier
 * carpeta de categoría. Cero mantenimiento al añadir categorías nuevas.
 */
const modules = import.meta.glob<GlobModule<FxPluginRegistration>>(
  '../plugins/*/*.ts',
  { eager: true }
);

// ═══════════════════════════════════════════════════════════════
// 🎯 BOOTSTRAP (se ejecuta al importar el módulo)
// ═══════════════════════════════════════════════════════════════

// 1. Limpiar el registry (idempotente para React.StrictMode DEV)
fxCatalogRegistry.clear();

// 2. Cargar todos los plugins descubiertos al registry
const discoveredCount = loadFromGlob(fxCatalogRegistry, modules);

// 3. Poblar el FxCatalog singleton con lo descubierto
for (const plugin of fxCatalogRegistry.getAll()) {
  FxCatalog.register(plugin);
}

if (import.meta.env.DEV) {
  console.info(
    `%c[FxCatalog] Listo: ${discoveredCount} plugins descubiertos`,
    'color:#a78bfa;font-weight:bold'
  );
}