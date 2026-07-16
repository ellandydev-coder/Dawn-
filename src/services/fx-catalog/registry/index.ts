// src/services/fx-catalog/registry/index.ts

// ═══════════════════════════════════════════════════════════════
// 📤 BARREL: exports públicos del registry de FX catalog
// ═══════════════════════════════════════════════════════════════

/*
 * Importar este barrel NO ejecuta el bootstrap.
 * El bootstrap se ejecuta al importar directamente:
 *   `import '@services/fx-catalog/registry/bootstrap'`
 *
 * Esto se hace UNA vez desde main.tsx (Lote 5).
 */

export type { FxPluginRegistration } from './fxCatalog.types';
export { fxCatalogRegistry } from './fxCatalogRegistry';