// src/features/preferences/registry/bootstrap.ts

import { loadFromGlob } from '@shared/registry/createRegistry';
import type { GlobModule } from '@shared/registry/registry.types';
import { preferencesRegistry } from './preferencesRegistry';
import type { PreferencePanelEntry } from './preferences.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 BOOTSTRAP DEL REGISTRY DE PREFERENCES
// ═══════════════════════════════════════════════════════════════

/**
 * Bootstrap del registry de Preferences.
 *
 * Se ejecuta UNA sola vez al arrancar la app (importado desde main.tsx).
 * Descubre todos los panels bajo `../panels/[dir]/index.ts` via Vite
 * glob eager y los carga en el registry.
 *
 * Reglas del glob:
 *   • Match: cualquier subcarpeta directa de `panels/`
 *   • Solo el archivo `index.ts` de cada carpeta
 *   • Los CSS, TSX, tests, etc. dentro de cada carpeta se ignoran
 *     (no matchean el pattern)
 *
 * Para añadir un panel nuevo:
 *   1. Crear carpeta: src/features/preferences/panels/mi-panel/
 *   2. Crear archivo index.ts con:
 *        export const registration: PreferencePanelEntry = { ... };
 *   3. Reiniciar (o esperar HMR de Vite)
 *   → El panel aparece automáticamente en el sidebar
 *
 * ⚠️ NO llames a este archivo desde código de features.
 * Se importa UNA vez en main.tsx (o en el entry del store).
 */

// ─── Descubrimiento via Vite glob eager ────────────────────────

/*
 * Nota sobre el patrón glob:
 *   '../panels/[carpeta]/index.ts' se escribe como '../panels/*[slash]index.ts'.
 *   Vite reemplaza [slash] por '/' internamente en el pattern real:
 *     import.meta.glob('../panels/[star][slash]index.ts', { eager: true })
 *
 * El pattern siguiente NO es una string dentro de un comentario, así
 * que puede usar el asterisco literal sin problemas de parsing:
 */
const modules = import.meta.glob<GlobModule<PreferencePanelEntry>>(
  '../panels/*/index.ts',
  { eager: true }
);

// ─── Carga en el registry ──────────────────────────────────────

const loadedCount = loadFromGlob(preferencesRegistry, modules);

if (import.meta.env.DEV) {
  console.info(
    `%c⚙️ Preferences registry ready: ${loadedCount} panels discovered`,
    'color:#a5b4fc;font-weight:bold'
  );
}

/**
 * Marca de bootstrap completado.
 * Exportamos algo para que Vite considere este módulo "usado" cuando
 * se importa desde main.tsx. No aporta lógica adicional.
 */
export const preferencesBootstrapped = true;