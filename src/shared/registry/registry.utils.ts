// src/shared/registry/registry.utils.ts

import type { RegistryEntry, Registry } from './registry.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 UTILIDADES DE REGISTRY
// ═══════════════════════════════════════════════════════════════

/**
 * Genera un comparador por campo string para usar en `sortBy`.
 *
 * Uso:
 * ```ts
 * const registry = createRegistry<MyEntry>({
 *   name: 'things',
 *   sortBy: sortByField('label'),
 * });
 * ```
 */
export function sortByField<T extends RegistryEntry>(
  field: keyof T & string
): (a: T, b: T) => number {
  return (a, b) => {
    const va = String(a[field] ?? '');
    const vb = String(b[field] ?? '');
    return va.localeCompare(vb);
  };
}

/**
 * Genera un comparador por campo numérico `order` para usar en `sortBy`.
 * Entries sin campo `order` van al final.
 *
 * Uso:
 * ```ts
 * const registry = createRegistry<MyEntry>({
 *   name: 'panels',
 *   sortBy: sortByOrder(),
 * });
 * ```
 */
export function sortByOrder<T extends RegistryEntry & { order?: number }>(): (
  a: T,
  b: T
) => number {
  return (a, b) => {
    const oa = a.order ?? Number.MAX_SAFE_INTEGER;
    const ob = b.order ?? Number.MAX_SAFE_INTEGER;
    return oa - ob;
  };
}

/**
 * Agrupa entries por un campo string (ej. `category`, `parentId`, `group`).
 *
 * Devuelve un Map donde cada key es el valor del campo, y el value
 * es el array de entries con ese valor.
 *
 * Uso:
 * ```ts
 * const byCategory = groupBy(registry.getAll(), 'category');
 * // Map<string, MyEntry[]>
 * ```
 */
export function groupBy<T extends RegistryEntry>(
  entries: readonly T[],
  field: keyof T & string
): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  for (const entry of entries) {
    const key = String(entry[field] ?? '__ungrouped__');
    let list = groups.get(key);
    if (!list) {
      list = [];
      groups.set(key, list);
    }
    list.push(entry);
  }

  return groups;
}

/**
 * Construye un árbol de 1 nivel a partir de entries que tienen `parentId`.
 *
 * Devuelve solo las entries raíz (sin parentId), cada una con su array
 * de children (entries cuyo parentId === root.id).
 *
 * Útil para sidebars de Preferences, FX Browser categories, etc.
 *
 * Uso:
 * ```ts
 * interface PanelEntry extends RegistryEntry {
 *   label: string;
 *   parentId?: string;
 * }
 *
 * const tree = buildTree(registry.getAll(), 'parentId');
 * // → [{ entry: root1, children: [child1, child2] }, ...]
 * ```
 */
export function buildTree<T extends RegistryEntry & { parentId?: string }>(
  entries: readonly T[]
): ReadonlyArray<{ entry: T; children: readonly T[] }> {
  const rootIds = new Set(
    entries.filter((e) => !e.parentId).map((e) => e.id)
  );

  const childrenByParentId = new Map<string, T[]>();

  for (const entry of entries) {
    if (!entry.parentId) continue;
    if (!rootIds.has(entry.parentId)) continue; // huérfano → ignora

    let list = childrenByParentId.get(entry.parentId);
    if (!list) {
      list = [];
      childrenByParentId.set(entry.parentId, list);
    }
    list.push(entry);
  }

  return entries
    .filter((e) => !e.parentId)
    .map((root) => ({
      entry: root,
      children: childrenByParentId.get(root.id) ?? [],
    }));
}

/**
 * Debug helper: imprime el contenido de un registry en consola.
 * Solo ejecuta en modo dev.
 *
 * Uso:
 * ```ts
 * debugRegistry(myRegistry);
 * ```
 */
export function debugRegistry<T extends RegistryEntry>(
  registry: Registry<T>
): void {
  if (!import.meta.env.DEV) return;

  const entries = registry.getAll();
  console.groupCollapsed(
    `📦 Registry "${registry.name}" (${entries.length} entries)`
  );
  for (const entry of entries) {
    console.log(`  • ${entry.id}`, entry);
  }
  console.groupEnd();
}