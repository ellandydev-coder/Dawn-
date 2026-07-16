// src/shared/components/icons/registry/bootstrap.ts

import { loadFromGlob } from '@shared/registry/createRegistry';
import type { GlobModule } from '@shared/registry/registry.types';
import { iconsRegistry } from './iconsRegistry';
import type { IconEntry } from './icons.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 BOOTSTRAP DEL REGISTRY DE ICONS
// ═══════════════════════════════════════════════════════════════

/**
 * Bootstrap del registry de icons.
 *
 * Se ejecuta UNA sola vez al arrancar la app (importado desde main.tsx).
 * Descubre TODOS los iconos via UN SOLO glob wildcard:
 *
 *   ../[cualquier-carpeta]/*.tsx
 *
 * Esto significa: crear una carpeta nueva bajo `icons/` (ej: `filters/`,
 * `arranger/`, `sample-browser/`...) y meter dentro un .tsx con
 * `export const registration = {...}` es SUFICIENTE.
 * Este archivo NO se toca jamás para añadir categorías o iconos.
 *
 * ─── Para añadir un icono nuevo ────────────────────────────────
 *   1. Ir a shared/components/icons/[categoria]/  (o crear la carpeta)
 *   2. Crear MiIcon.tsx con el componente React normal
 *   3. Al final del archivo, exportar registration:
 *
 *        export const registration: IconEntry = {
 *          id: 'categoria.mi-icono',
 *          category: 'categoria',
 *          component: MiIcon,
 *          aliases: ['nombre-alternativo'],  // opcional
 *        };
 *
 *   4. Reiniciar (o esperar HMR). El icono queda disponible via:
 *        <Icon name="categoria.mi-icono" />
 *        <Icon name="nombre-alternativo" />   ← si tiene alias
 *
 * ─── Archivos ignorados ────────────────────────────────────────
 * El pattern `../[carpeta]/*.tsx` NO captura archivos en la raíz
 * de `icons/` (como Icon.tsx o IconBase.tsx). Solo los .tsx que
 * viven DENTRO de una subcarpeta. Por eso no hay riesgo de que
 * Icon.tsx o IconBase.tsx acaben en el registry por accidente.
 *
 * Y los .tsx dentro de subcarpetas que NO exporten `registration`
 * se ignoran silenciosamente (loadFromGlob salta módulos sin ese
 * export). Así que si alguna vez añades un helper .tsx dentro de
 * una carpeta de iconos, tampoco rompe nada.
 *
 * ⚠️ NO llamar a este archivo desde código de features.
 * Se importa UNA vez en main.tsx.
 */

// ─── Un solo glob wildcard cubre TODAS las subcarpetas ─────────

const modules = import.meta.glob<GlobModule<IconEntry>>(
  '../*/*.tsx',
  { eager: true }
);

// ─── Carga en el registry ──────────────────────────────────────

const loadedCount = loadFromGlob(iconsRegistry, modules);

if (import.meta.env.DEV) {
  console.info(
    `%c🎨 Icons registry ready: ${loadedCount} icons discovered`,
    'color:#f0abfc;font-weight:bold'
  );
}

/**
 * Marca de bootstrap completado.
 * Export dummy para que Vite trate el módulo como usado al importarlo.
 */
export const iconsBootstrapped = true;