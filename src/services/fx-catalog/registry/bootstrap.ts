// src/services/fx-catalog/registry/bootstrap.ts

import { loadFromGlob } from '@shared/registry/createRegistry';
import type { GlobModule } from '@shared/registry/registry.types';
import { FxCatalog } from '../FxCatalog';
import { fxCatalogRegistry } from './fxCatalogRegistry';
import type { FxPluginRegistration } from './fxCatalog.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 GLOB — descubre plugins/[categoria]/[NombrePlugin]/manifest.ts
// ═══════════════════════════════════════════════════════════════

/**
 * Un solo glob wildcard descubre TODOS los plugins bajo cualquier
 * carpeta de categoría. Cada plugin vive en su propia carpeta con
 * un `manifest.ts` obligatorio como punto de entrada.
 *
 * Estructura esperada:
 *   plugins/[categoria]/[NombrePlugin]/manifest.ts   ← descubierto
 *   plugins/[categoria]/[NombrePlugin]/*.tsx          ← libre (UI)
 *   plugins/[categoria]/[NombrePlugin]/*.css          ← libre
 *   plugins/[categoria]/[NombrePlugin]/native/*.cpp   ← libre (DSP)
 *   plugins/[categoria]/[NombrePlugin]/*.wasm         ← libre
 *
 * Solo `manifest.ts` se escanea. El resto se carga lazy desde el
 * manifest cuando el plugin se instancia.
 */
const modules = import.meta.glob<GlobModule<FxPluginRegistration>>(
  '../plugins/*/*/manifest.ts',
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