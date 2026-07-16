// src/shared/registry/registry.types.ts

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS BASE DEL FRAMEWORK DE REGISTRY
// ═══════════════════════════════════════════════════════════════

/**
 * Contrato mínimo que debe cumplir cualquier entry registrable.
 *
 * Cada dominio extiende esta interfaz con sus campos propios:
 *   - PreferencePanelEntry extiende con `component`, `defaults`, etc.
 *   - FxPluginEntry extiende con `category`, `factory`, etc.
 *   - ShortcutEntry extiende con `keys`, `handler`, etc.
 *
 * El `id` es la clave única dentro del registry. No puede haber
 * duplicados — el registry lanza warning en dev si detecta uno.
 */
export interface RegistryEntry {
  /** Identificador único dentro del registry */
  readonly id: string;
}

/**
 * Opciones para crear un registry.
 */
export interface RegistryOptions<T extends RegistryEntry> {
  /** Nombre del registry (para logs y debugging) */
  readonly name: string;

  /**
   * Función opcional de validación que se ejecuta al registrar
   * cada entry. Si devuelve un string, es un error y la entry
   * NO se registra (se loguea warning en dev).
   * Si devuelve null/undefined, la entry es válida.
   */
  readonly validate?: (entry: T) => string | null | undefined;

  /**
   * Función opcional de ordenación.
   * Si se provee, `getAll()` devuelve las entries ordenadas.
   * Si no se provee, se devuelven en orden de registro.
   */
  readonly sortBy?: (a: T, b: T) => number;
}

/**
 * Interfaz pública de un Registry.
 *
 * Diseñado como **lookup inmutable** después del arranque:
 *   - `register()` se llama durante la fase de bootstrap (eager glob)
 *   - `getAll()`, `getById()`, `filter()` se usan en runtime
 *
 * No es reactive (no emite eventos). Los consumidores leen una
 * vez al montar y eso es suficiente porque el registro no cambia
 * después del bootstrap.
 *
 * API genérica — funciona para cualquier tipo que extienda RegistryEntry.
 */
export interface Registry<T extends RegistryEntry> {
  /** Nombre del registry (para debugging) */
  readonly name: string;

  /**
   * Registra una entry. Idempotente: si el id ya existe,
   * loguea warning en dev y sobrescribe.
   */
  register(entry: T): void;

  /**
   * Registra múltiples entries de una sola vez.
   * Equivalente a llamar `register()` en loop.
   */
  registerAll(entries: readonly T[]): void;

  /**
   * Devuelve todas las entries registradas.
   * Si se configuró `sortBy`, vienen ordenadas.
   * Devuelve copia defensiva (array nuevo en cada llamada).
   */
  getAll(): readonly T[];

  /**
   * Busca una entry por id. Devuelve `null` si no existe.
   * O(1) — lookup directo en Map.
   */
  getById(id: string): T | null;

  /**
   * Filtra entries según un predicado.
   * Útil para "dame todas las entries de categoría X".
   */
  filter(predicate: (entry: T) => boolean): readonly T[];

  /**
   * true si existe una entry con ese id.
   */
  has(id: string): boolean;

  /** Número total de entries registradas */
  readonly size: number;

  /**
   * Elimina una entry. Rara vez se usa (hot-reload, testing).
   * Devuelve true si existía y fue eliminada.
   */
  unregister(id: string): boolean;

  /** Elimina todas las entries. Solo para testing/reset. */
  clear(): void;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS PARA VITE GLOB EAGER
// ═══════════════════════════════════════════════════════════════

/**
 * Tipo que modela lo que devuelve `import.meta.glob(pattern, { eager: true })`.
 *
 * Cada key es el path del módulo (ej: "./panels/vst/index.ts").
 * Cada value es el módulo importado con sus exports.
 *
 * Uso (nota: el patrón real usa asterisco-barra que aquí evitamos en el
 * comentario para no confundir al parser JSDoc):
 *
 *   const modules = import.meta.glob(
 *     './panels/[carpeta]/index.ts',
 *     { eager: true }
 *   );
 *   loadFromGlob(registry, modules);
 */
export type GlobModule<T extends RegistryEntry> = {
  /**
   * Export nombrado estándar: cada módulo auto-registrable
   * debe exportar `registration` con la entry (o array de entries).
   *
   * Ejemplo en un archivo panel:
   *   export const registration: PreferencePanelEntry = { id, ... };
   *
   * O para registrar varios de un solo archivo:
   *   export const registration: PreferencePanelEntry[] = [
   *     { id: 'a', ... },
   *     { id: 'b', ... },
   *   ];
   */
  readonly registration?: T | readonly T[];
};

/**
 * Resultado de `import.meta.glob(pattern, { eager: true })`.
 * Record de path → módulo importado.
 */
export type GlobModules<T extends RegistryEntry> = Record<
  string,
  GlobModule<T>
>;