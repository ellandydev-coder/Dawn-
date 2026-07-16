// src/app/config/shortcuts.ts
//
// Atajos cross-feature que no pertenecen a ninguna feature concreta.
// Solo viven aquí: Undo/Redo (history slice global) + Guardar proyecto.
//
// El resto de atajos viven en cada features/[nombre]/shortcuts.ts
// y se registran automáticamente via bootstrapShortcuts().

import { undo, redo } from '@state/slices/history/historySlice';
import { pending } from '@services/shortcuts/registry/shortcutHelpers';
import type { ShortcutRegistration } from '@services/shortcuts/registry';

// ═══════════════════════════════════════════════════════════════
// 📤 REGISTRATION
// ═══════════════════════════════════════════════════════════════

export const registration: ShortcutRegistration = {
  id: 'app',
  label: '💾 App',
  build: (ctx) => [
    {
      keys: 'ctrl+z',
      description: 'Deshacer último gesto',
      category: '✏️ Edición',
      handler: () => {
        if (ctx.getState().history.past.length === 0) return;
        ctx.dispatch(undo());
      },
    },
    {
      keys: 'ctrl+shift+z',
      description: 'Rehacer último gesto',
      category: '✏️ Edición',
      handler: () => {
        if (ctx.getState().history.future.length === 0) return;
        ctx.dispatch(redo());
      },
    },
    {
      keys: 'ctrl+y',
      description: 'Rehacer último gesto (alternativo Windows)',
      category: '✏️ Edición',
      handler: () => {
        if (ctx.getState().history.future.length === 0) return;
        ctx.dispatch(redo());
      },
    },
    {
      keys: 'ctrl+s',
      description: 'Guardar proyecto',
      category: '💾 Proyecto',
      handler: pending('Guardar proyecto'),
    },
  ],
};