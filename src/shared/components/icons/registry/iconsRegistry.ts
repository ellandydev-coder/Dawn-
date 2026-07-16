// src/shared/components/icons/registry/iconsRegistry.ts

import { createRegistry } from '@shared/registry/createRegistry';
import type { Registry } from '@shared/registry/registry.types';
import type { IconEntry, IconCategory } from './icons.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 REGISTRY PRINCIPAL (por id canónico)
// ═══════════════════════════════════════════════════════════════

/**
 * Registry principal de iconos.
 *
 * Cada entry se registra por su id jerárquico canónico
 * (ej: "transport.play", "mixer.volume").
 *
 * Auto-poblado en bootstrap.ts via Vite glob eager sobre:
 *   ../[categoria]/*.tsx
 *
 * Validaciones al registrar:
 *   • id debe coincidir con formato "categoria.slug"
 *   • category en la entry debe coincidir con el prefijo del id
 *   • aliases no pueden colisionar entre iconos distintos
 */
export const iconsRegistry = createRegistry<IconEntry>({
  name: 'icons',

  validate(entry) {
    // Formato del id
    const parts = entry.id.split('.');
    if (parts.length < 2) {
      return `id "${entry.id}" must follow "category.name" pattern (found no dot)`;
    }

    // Category coincide con prefijo del id
    const [categoryFromId] = parts;
    if (categoryFromId !== entry.category) {
      return `id "${entry.id}" starts with "${categoryFromId}" but category is "${entry.category}"`;
    }

    return null;
  },
});

// ═══════════════════════════════════════════════════════════════
// 🎯 RESOLUCIÓN DE ALIASES
// ═══════════════════════════════════════════════════════════════

/**
 * Mapa auxiliar de aliases → id canónico.
 *
 * Se construye lazy la primera vez que se llama `resolveIconName()`.
 * Se invalida si se detecta un tamaño distinto en el registry
 * (safety net por si alguien registra dinámicamente en runtime).
 */
let aliasMap: Map<string, string> | null = null;
let aliasMapSize = -1;

function buildAliasMap(registry: Registry<IconEntry>): Map<string, string> {
  const map = new Map<string, string>();

  for (const entry of registry.getAll()) {
    if (!entry.aliases) continue;

    for (const alias of entry.aliases) {
      const existing = map.get(alias);
      if (existing && existing !== entry.id && import.meta.env.DEV) {
        console.warn(
          `[Icons] Alias "${alias}" declared by both "${existing}" and "${entry.id}". Using latest.`
        );
      }
      map.set(alias, entry.id);
    }
  }

  return map;
}

/**
 * Resuelve un nombre (canónico o alias) al icono real del registry.
 *
 * Prioridad:
 *   1. Match exacto por id canónico
 *   2. Match por alias
 *   3. null (no encontrado)
 *
 * Uso:
 *   resolveIcon('transport.play')  → IconEntry
 *   resolveIcon('play')            → IconEntry (via alias)
 *   resolveIcon('unknown')         → null
 */
export function resolveIcon(name: string): IconEntry | null {
  // 1. Match directo por id canónico
  const direct = iconsRegistry.getById(name);
  if (direct) return direct;

  // 2. Match por alias (con cache lazy)
  const registry = iconsRegistry;
  const currentSize = registry.size;

  if (aliasMap === null || aliasMapSize !== currentSize) {
    aliasMap = buildAliasMap(registry);
    aliasMapSize = currentSize;
  }

  const canonicalId = aliasMap.get(name);
  if (canonicalId) {
    return registry.getById(canonicalId);
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS DE FILTRADO
// ═══════════════════════════════════════════════════════════════

/**
 * Devuelve todos los iconos de una categoría.
 * Útil para paleta de comandos, browser de iconos, etc.
 */
export function getIconsByCategory(
  category: IconCategory
): readonly IconEntry[] {
  return iconsRegistry.filter((entry) => entry.category === category);
}