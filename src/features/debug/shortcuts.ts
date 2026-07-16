// src/features/debug/shortcuts.ts

import { toggleDebug } from '@state/slices/ui/uiSlice';
import type { ShortcutRegistration } from '@services/shortcuts/registry';

// ═══════════════════════════════════════════════════════════════
// 📤 REGISTRATION
// ═══════════════════════════════════════════════════════════════

export const registration: ShortcutRegistration = {
  id: 'debug',
  label: '🐛 Debug',
  build: (ctx) => [
    {
      keys: 'd',
      description: 'Mostrar / Ocultar Debug',
      category: '🖥️ Vista',
      handler: () => ctx.dispatch(toggleDebug()),
    },
  ],
};