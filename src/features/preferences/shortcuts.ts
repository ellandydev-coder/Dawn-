// src/features/preferences/shortcuts.ts

import { togglePreferences } from '@state/slices/ui/uiSlice';
import type { ShortcutRegistration } from '@services/shortcuts/registry';

// ═══════════════════════════════════════════════════════════════
// 📤 REGISTRATION
// ═══════════════════════════════════════════════════════════════

export const registration: ShortcutRegistration = {
  id: 'preferences',
  label: '⚙️ Preferences',
  build: (ctx) => [
    {
      keys: 'ctrl+p',
      description: 'Mostrar / Ocultar Preferences',
      category: '🖥️ Vista',
      /*
       * ⚠️ Ctrl+P es el atajo nativo del navegador para "Imprimir".
       * shortcutManager llama preventDefault() automáticamente.
       */
      handler: () => ctx.dispatch(togglePreferences()),
    },
  ],
};