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
 * Descubre panels via Vite glob eager con DOS patterns:
 *
 * 1. `../panels/[dir]/index.ts` → paneles con panel real (component)
 *    Ejemplo: panels/vst/index.ts
 *
 * 2. `../panels/_seed/*.ts` → registros seed temporales
 *    (categorías raíz agrupadoras + sub-categorías sin panel real aún)
 *
 * ─── Para añadir un panel REAL ─────────────────────────────────
 *   1. Crear carpeta: src/features/preferences/panels/mi-panel/
 *   2. index.ts con: export const registration = { id, ..., component }
 *   3. Si esa entry estaba en _seed/subs.ts, ELIMINARLA de allí
 *      (para evitar warning de duplicado)
 *   4. Reiniciar Vite (o esperar HMR)
 *   → El panel aparece automáticamente con su UI real
 *
 * ─── Para añadir una CATEGORÍA agrupadora nueva ────────────────
 *   Añadir entry a `_seed/roots.ts` sin `component`.
 *
 * ⚠️ NO llamar a este archivo desde código de features.
 * Se importa UNA vez en main.tsx.
 */

// ─── Glob 1: paneles reales con carpeta propia ─────────────────

const panelModules = import.meta.glob<GlobModule<PreferencePanelEntry>>(
  '../panels/*/index.ts',
  { eager: true }
);

// ─── Glob 2: seed (raíces + placeholders temporales) ───────────

const seedModules = import.meta.glob<GlobModule<PreferencePanelEntry>>(
  '../panels/_seed/*.ts',
  { eager: true }
);

// ─── Carga en el registry ──────────────────────────────────────

const panelCount = loadFromGlob(preferencesRegistry, panelModules);
const seedCount = loadFromGlob(preferencesRegistry, seedModules);

if (import.meta.env.DEV) {
  console.info(
    `%c⚙️ Preferences registry ready: ${panelCount} real panels + ${seedCount} seed entries = ${preferencesRegistry.size} total`,
    'color:#a5b4fc;font-weight:bold'
  );
}

/**
 * Marca de bootstrap completado (para que Vite trate el módulo como usado).
 */
export const preferencesBootstrapped = true;