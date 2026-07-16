// src/shared/components/icons/registry/icons.types.ts

import type { ComponentType } from 'react';
import type { RegistryEntry } from '@shared/registry/registry.types';
import type { IconProps } from '../types';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/**
 * Categoría de un icono.
 *
 * Corresponde con el nombre de la carpeta física donde vive el icono:
 *   src/shared/components/icons/[categoria]/MiIcon.tsx
 *
 * Es un `string` libre (no un union cerrado) para maximizar la
 * extensibilidad: crear una carpeta nueva bajo `icons/` y meter
 * un icono dentro es suficiente — no requiere editar este archivo
 * ni el bootstrap.
 *
 * Convención: kebab-case (ej: "transport", "media", "sample-browser").
 * Se valida en runtime que coincida con el prefijo del `id`.
 */
export type IconCategory = string;

/**
 * Componente React de un icono.
 * Acepta props estándar (size, color, strokeWidth, filled, title).
 */
export type IconComponent = ComponentType<IconProps>;

/**
 * Entry de un icono en el registry.
 *
 * ─── CAMPOS OBLIGATORIOS ───
 *   • id         → jerárquico "categoria.nombre" (ej: "transport.play")
 *   • category   → coincide con el prefijo del id (redundante pero
 *                  facilita filter/group + validación cruzada)
 *   • component  → componente React que renderiza el SVG
 *
 * ─── CAMPOS OPCIONALES ───
 *   • aliases    → nombres alternativos para retrocompatibilidad
 *                  (ej: 'play' es alias de 'transport.play')
 *   • label      → nombre humano ("Play", "Volume mute") para debug/tooltips
 *   • keywords   → tags para búsqueda futura (paleta de comandos, browser)
 *
 * ─── CONVENCIÓN DE IDs ───
 *   Formato: "categoria.kebab-case"
 *   Ejemplos válidos:
 *     transport.play
 *     transport.skip-back
 *     mixer.volume-mute
 *     toolbar.new-project
 *
 *   El prefijo DEBE coincidir con `category` (validado al registrar).
 */
export interface IconEntry extends RegistryEntry {
  /** Categoría (coincide con el prefijo del id y el nombre de carpeta) */
  readonly category: IconCategory;

  /** Componente React del icono */
  readonly component: IconComponent;

  /**
   * Aliases opcionales — nombres alternativos que resuelven al mismo icono.
   * Útil para retrocompatibilidad:
   *   registration: {
   *     id: 'transport.play',
   *     aliases: ['play'],   // <Icon name="play"> también funciona
   *     ...
   *   }
   */
  readonly aliases?: readonly string[];

  /** Nombre humano legible (opcional, para debug/tooltip) */
  readonly label?: string;

  /**
   * Palabras clave para búsqueda futura (paleta de comandos, buscador).
   * Ejemplo: keywords: ['mute', 'silent', 'off']
   */
  readonly keywords?: readonly string[];
}