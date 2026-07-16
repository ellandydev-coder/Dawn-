// src/services/shortcuts/registry/shortcuts.types.ts

import type { Store } from '@reduxjs/toolkit';
import type { RootState, AppDispatch } from '@state/store';
import type { RegistryEntry } from '@shared/registry/registry.types';
import type { ShortcutDefinition } from '../shortcutTypes';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/**
 * Store tipado con AppDispatch para soportar thunks.
 * Se importa aquí para exponerlo desde el barrel público.
 */
export type TypedStore = Store<RootState> & { dispatch: AppDispatch };

/**
 * Contexto que se pasa a cada grupo de shortcuts al construirlo.
 * Encapsula dispatch + getState del store — evita que cada feature
 * tenga que importar `store` directamente (rompería boundaries).
 */
export interface ShortcutCtx {
  readonly dispatch: AppDispatch;
  readonly getState: () => RootState;
}

/**
 * Shortcut sin `context` — se agrega automáticamente como 'global'
 * en el bootstrap. Las features no deberían preocuparse por el
 * contexto (todos los shortcuts distribuidos son globales por ahora).
 */
export type GlobalShortcut = Omit<ShortcutDefinition, 'context'>;

/**
 * Entry de un grupo de shortcuts en el registry.
 *
 * ─── CAMPOS OBLIGATORIOS ───
 *   • id     → id del grupo (== nombre de la feature: "transport", "mixer")
 *   • label  → título humano con emoji para el overlay F1 ("🎬 Transport")
 *   • build  → factory que recibe ctx y devuelve los shortcuts del grupo
 *
 * ─── EJEMPLO ───
 * ```ts
 * // src/features/transport/shortcuts.ts
 * import { play, pause } from '@state/slices/transport/transportSlice';
 * import type { ShortcutRegistration } from '@services/shortcuts/registry';
 *
 * export const registration: ShortcutRegistration = {
 *   id: 'transport',
 *   label: '🎬 Transport',
 *   build: (ctx) => [
 *     {
 *       keys: 'space',
 *       description: 'Play / Pause',
 *       category: '🎬 Transport',
 *       handler: () => {
 *         const isPlaying = ctx.getState().transport.isPlaying;
 *         ctx.dispatch(isPlaying ? pause() : play());
 *       },
 *     },
 *   ],
 * };
 * ```
 *
 * ─── CONVENCIÓN ───
 *   El `id` debe coincidir con el nombre de la feature (kebab-case)
 *   y ser único en todo el registry.
 */
export interface ShortcutRegistration extends RegistryEntry {
  /** Id del grupo (== nombre de feature, kebab-case) */
  readonly id: string;

  /** Título humano con emoji, mostrado en el overlay F1 */
  readonly label: string;

  /**
   * Factory que construye la lista de shortcuts del grupo.
   * Recibe el `ctx` con dispatch/getState y devuelve los shortcuts
   * como array plano. Los shortcuts se registran automáticamente
   * con context='global' en el bootstrap.
   */
  readonly build: (ctx: ShortcutCtx) => readonly GlobalShortcut[];
}