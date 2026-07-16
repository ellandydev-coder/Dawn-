// src/shared/registry/createRegistry.ts

import type {
  Registry,
  RegistryEntry,
  RegistryOptions,
  GlobModules,
} from './registry.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 FACTORY: createRegistry
// ═══════════════════════════════════════════════════════════════

/**
 * createRegistry
 * --------------
 * Factory genérica que crea un Registry tipado para cualquier dominio.
 *
 * Diseño:
 *   - Un solo Map<string, T> como store interno
 *   - Validación opcional al registrar
 *   - Ordenación opcional al leer
 *   - Warnings en dev para duplicados y validación fallida
 *   - API inmutable en runtime (register se usa solo en bootstrap)
 *
 * Uso:
 *   // 1. Definir tipo
 *   interface MyEntry extends RegistryEntry {
 *     label: string;
 *     component: React.FC;
 *   }
 *
 *   // 2. Crear registry
 *   export const myRegistry = createRegistry<MyEntry>({ name: 'my-things' });
 *
 *   // 3. Registrar (manual o via glob)
 *   myRegistry.register({ id: 'foo', label: 'Foo', component: FooPanel });
 *
 *   // 4. O bulk-load desde Vite glob eager
 *   const modules = import.meta.glob('./things/[dir]/index.ts', { eager: true });
 *   loadFromGlob(myRegistry, modules);
 *
 *   // 5. Leer
 *   myRegistry.getAll();       // readonly MyEntry[]
 *   myRegistry.getById('foo'); // MyEntry | null
 *
 * @param options — nombre, validador opcional, ordenación opcional
 * @returns Registry<T> — instancia lista para usar
 */
export function createRegistry<T extends RegistryEntry>(
  options: RegistryOptions<T>
): Registry<T> {
  const { name, validate, sortBy } = options;
  const store = new Map<string, T>();

  // Cache de getAll() — se invalida al registrar/eliminar
  let cachedAll: readonly T[] | null = null;

  function invalidateCache(): void {
    cachedAll = null;
  }

  function buildAll(): readonly T[] {
    const entries = Array.from(store.values());
    if (sortBy) entries.sort(sortBy);
    return Object.freeze(entries);
  }

  // ─── Implementación ──────────────────────────────────────

  const registry: Registry<T> = {
    name,

    register(entry: T): void {
      // Validación
      if (validate) {
        const error = validate(entry);
        if (error) {
          if (import.meta.env.DEV) {
            console.warn(
              `[Registry:${name}] ❌ Validation failed for "${entry.id}": ${error}. Skipped.`
            );
          }
          return;
        }
      }

      // Duplicado
      if (store.has(entry.id) && import.meta.env.DEV) {
        console.warn(
          `[Registry:${name}] ⚠️ Duplicate id "${entry.id}". Overwriting.`
        );
      }

      store.set(entry.id, entry);
      invalidateCache();
    },

    registerAll(entries: readonly T[]): void {
      for (const entry of entries) {
        registry.register(entry);
      }
    },

    getAll(): readonly T[] {
      if (cachedAll === null) {
        cachedAll = buildAll();
      }
      return cachedAll;
    },

    getById(id: string): T | null {
      return store.get(id) ?? null;
    },

    filter(predicate: (entry: T) => boolean): readonly T[] {
      return registry.getAll().filter(predicate);
    },

    has(id: string): boolean {
      return store.has(id);
    },

    get size(): number {
      return store.size;
    },

    unregister(id: string): boolean {
      const existed = store.delete(id);
      if (existed) invalidateCache();
      return existed;
    },

    clear(): void {
      store.clear();
      invalidateCache();
    },
  };

  return registry;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 LOADER: loadFromGlob
// ═══════════════════════════════════════════════════════════════

/**
 * loadFromGlob
 * ------------
 * Carga entries en un registry desde el resultado de `import.meta.glob()`.
 *
 * Cada módulo debe exportar `registration` (una entry o un array).
 * Módulos sin `registration` se ignoran silenciosamente (permite
 * tener archivos CSS, tests, etc. en las carpetas de plugins sin
 * que rompan el sistema).
 *
 * Uso:
 *   const modules = import.meta.glob<GlobModule<MyEntry>>(
 *     './panels/[dir]/index.ts',
 *     { eager: true }
 *   );
 *   loadFromGlob(myRegistry, modules);
 *
 * Después de esto, `myRegistry.getAll()` devuelve todas las entries
 * descubiertas por el glob, listas para consumir.
 *
 * @param registry — el registry destino
 * @param modules — resultado de import.meta.glob con eager: true
 * @returns número de entries registradas
 */
export function loadFromGlob<T extends RegistryEntry>(
  registry: Registry<T>,
  modules: GlobModules<T>
): number {
  let count = 0;

  for (const [path, mod] of Object.entries(modules)) {
    if (!mod.registration) {
      // Módulo sin export `registration` → lo ignoramos.
      // Esto es normal (CSS, tests, utils dentro de la carpeta).
      continue;
    }

    const reg = mod.registration;

    if (Array.isArray(reg)) {
      // El módulo exporta un array de entries
      for (const entry of reg) {
        registry.register(entry as T);
        count++;
      }
    } else {
      // El módulo exporta una sola entry
      registry.register(reg as T);
      count++;
    }

    if (import.meta.env.DEV && count === 0) {
      console.warn(
        `[Registry:${registry.name}] Module "${path}" has registration but it was empty.`
      );
    }
  }

  if (import.meta.env.DEV) {
    console.info(
      `%c📦 [Registry:${registry.name}] Loaded ${count} entries from glob (${Object.keys(modules).length} modules scanned)`,
      'color:#4ade80;font-weight:bold'
    );
  }

  return count;
}