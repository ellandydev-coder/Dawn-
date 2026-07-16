// src/features/shortcuts/index.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 Barrel export del feature shortcuts
// --------------------------------------------------------------
// UI + hooks para el sistema de atajos de teclado.
// El servicio de bajo nivel vive en `services/shortcuts/ShortcutManager`.
//
// Uso típico:
//   import { ShortcutsOverlay } from '@features/shortcuts';
//   import { useShortcut } from '@features/shortcuts';
// ═══════════════════════════════════════════════════════════════

export { ShortcutsOverlay } from './components/ShortcutsOverlay';

export {
  useShortcut,
  useShortcuts,
  useShortcutContext,
} from './hooks/useKeyboardShortcuts';