/**
 * useKeyboardShortcuts.ts
 * -----------------------
 * Hooks para registrar atajos desde componentes React.
 *
 * Uso básico:
 *   useShortcut('timeline', {
 *     'Space':  () => togglePlay(),
 *     'Ctrl+Z': () => undo(),
 *   });
 *
 * Uso avanzado (con metadatos):
 *   useShortcuts([
 *     { keys: 'F1', description: 'Ayuda', category: 'General',
 *       context: 'global', handler: openHelp },
 *   ]);
 */

import { useEffect } from 'react';
import { shortcutManager } from '@services/shortcuts/ShortcutManager';
import type {
  ShortcutContext,
  ShortcutDefinition,
  ShortcutMap,
} from '@services/shortcuts/shortcutTypes';

/**
 * Hook simple: registra un mapa de atajos en un contexto.
 * Los metadatos (description, category) se ponen genéricos.
 * Para descripciones bonitas en la modal usa `useShortcuts` o el config global.
 */
export function useShortcut(
  context: ShortcutContext,
  map: ShortcutMap,
  options?: { category?: string; enabled?: boolean }
) {
  const { category = 'General', enabled = true } = options ?? {};

  useEffect(() => {
    if (!enabled) return;

    const unregs = Object.entries(map).map(([keys, handler]) =>
      shortcutManager.register({
        keys,
        description: keys,
        context,
        category,
        handler,
      })
    );

    return () => unregs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, category, enabled]);
}

/**
 * Hook avanzado: registra atajos con metadatos completos.
 */
export function useShortcuts(defs: ShortcutDefinition[], enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const unregs = defs.map((d) => shortcutManager.register(d));
    return () => unregs.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}

/**
 * Hook para activar/desactivar un contexto (ej. cuando entras al mixer).
 */
export function useShortcutContext(context: ShortcutContext, active: boolean) {
  useEffect(() => {
    if (active) shortcutManager.activateContext(context);
    else shortcutManager.deactivateContext(context);
    return () => shortcutManager.deactivateContext(context);
  }, [context, active]);
}