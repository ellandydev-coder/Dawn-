// src/shared/components/icons/registry/iconIds.ts

import { iconsRegistry } from './iconsRegistry';

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPER DE AUTOCOMPLETADO EN RUNTIME
// ═══════════════════════════════════════════════════════════════

/**
 * Proxy que expone los ids canónicos del registry como propiedades
 * accesibles con autocompletado del IDE (via TypeScript).
 *
 * Uso:
 *   import { IconIds } from '@shared/components/icons/registry';
 *
 *   <Icon name={IconIds.transport.play} />
 *   <Icon name={IconIds.mixer.volumeMute} />
 *
 * Ventaja frente a un string literal:
 *   • Autocompletado del IDE
 *   • Rename-safe (si cambias el id, TS te avisa)
 *   • Documentación inline si el editor la soporta
 *
 * Los que prefieran velocidad pueden seguir usando strings:
 *   <Icon name="transport.play" />   ← también válido
 *
 * ─── Implementación ────────────────────────────────────────────
 * Se construye lazy la primera vez que se accede. Cada key es
 * el "slug" del id (kebab-case convertido a camelCase para
 * ser válido como identificador JS).
 *
 * Ejemplo:
 *   registry entry: 'mixer.volume-mute'
 *   IconIds.mixer.volumeMute  → 'mixer.volume-mute'
 */

/**
 * Convierte 'volume-mute' → 'volumeMute'.
 * Válido como identificador JavaScript.
 */
function toCamelCase(slug: string): string {
  return slug.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

/**
 * Estructura del objeto IconIds:
 *   {
 *     transport: { play: 'transport.play', pause: 'transport.pause', ... },
 *     mixer:     { volume: 'mixer.volume', volumeMute: 'mixer.volume-mute', ... },
 *     ...
 *   }
 *
 * Tipado como Record<string, Record<string, string>> — los consumidores
 * usan `IconIds.transport.play` y obtienen el string canónico.
 */
type IconIdsShape = Readonly<Record<string, Readonly<Record<string, string>>>>;

let cachedIconIds: IconIdsShape | null = null;
let cachedSize = -1;

/**
 * Getter lazy del objeto IconIds. Se construye al primer acceso
 * y se cachea. Se reconstruye si el tamaño del registry cambió
 * (ej: hot-reload añadiendo un icono nuevo).
 */
function buildIconIds(): IconIdsShape {
  const result: Record<string, Record<string, string>> = {};

  for (const entry of iconsRegistry.getAll()) {
    // 'transport.play' → ['transport', 'play']
    // 'toolbar.grid-visibility' → ['toolbar', 'grid-visibility']
    const [category, ...slugParts] = entry.id.split('.');
    if (!category || slugParts.length === 0) continue;

    const slug = slugParts.join('.');
    const camelKey = toCamelCase(slug);

    if (!result[category]) {
      result[category] = {};
    }
    result[category][camelKey] = entry.id;
  }

  // Congelamos cada categoría y el objeto raíz para prevenir mutaciones
  for (const cat of Object.keys(result)) {
    Object.freeze(result[cat]);
  }
  return Object.freeze(result) as IconIdsShape;
}

/**
 * Objeto IconIds con autocompletado.
 *
 * Se accede como getter (Proxy) para no ejecutar el build hasta
 * que se use por primera vez, y para reconstruir si cambió el
 * tamaño del registry.
 *
 * En dev, TypeScript no puede inferir keys dinámicas — el tipo
 * es Record<string, Record<string, string>>. Para tener strings
 * literales tipados harían falta code-gen o Type.ts avanzado
 * (no lo hacemos ahora para no complicar).
 */
export const IconIds: IconIdsShape = new Proxy({} as IconIdsShape, {
  get(_, prop: string) {
    if (cachedIconIds === null || cachedSize !== iconsRegistry.size) {
      cachedIconIds = buildIconIds();
      cachedSize = iconsRegistry.size;
    }
    return cachedIconIds[prop];
  },

  has(_, prop: string) {
    if (cachedIconIds === null || cachedSize !== iconsRegistry.size) {
      cachedIconIds = buildIconIds();
      cachedSize = iconsRegistry.size;
    }
    return prop in cachedIconIds;
  },

  ownKeys() {
    if (cachedIconIds === null || cachedSize !== iconsRegistry.size) {
      cachedIconIds = buildIconIds();
      cachedSize = iconsRegistry.size;
    }
    return Reflect.ownKeys(cachedIconIds);
  },

  getOwnPropertyDescriptor(_, prop: string) {
    if (cachedIconIds === null || cachedSize !== iconsRegistry.size) {
      cachedIconIds = buildIconIds();
      cachedSize = iconsRegistry.size;
    }
    return Reflect.getOwnPropertyDescriptor(cachedIconIds, prop);
  },
});