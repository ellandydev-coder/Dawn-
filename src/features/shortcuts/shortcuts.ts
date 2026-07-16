// src/features/shortcuts/shortcuts.ts

import {
  toggleShortcutsOverlay,
  setShortcutsOverlay,
} from '@state/slices/ui/uiSlice';
import type { ShortcutRegistration } from '@services/shortcuts/registry';

// ═══════════════════════════════════════════════════════════════
// 📤 REGISTRATION
// ═══════════════════════════════════════════════════════════════

export const registration: ShortcutRegistration = {
  id: 'shortcuts',
  label: '❓ Ayuda',
  build: (ctx) => [
    {
      keys: 'f1',
      description: 'Mostrar atajos de teclado',
      category: '❓ Ayuda',
      handler: () => ctx.dispatch(toggleShortcutsOverlay()),
    },
    {
      keys: 'shift+/',
      description: 'Mostrar atajos de teclado (?)',
      category: '❓ Ayuda',
      handler: () => ctx.dispatch(toggleShortcutsOverlay()),
    },
    {
      keys: 'esc',
      description: 'Cerrar diálogos / atajos',
      category: '❓ Ayuda',
      allowInInputs: true,
      handler: () => {
        if (ctx.getState().ui.showShortcutsOverlay) {
          ctx.dispatch(setShortcutsOverlay(false));
        }
      },
    },
  ],
};