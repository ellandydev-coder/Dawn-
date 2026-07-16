// src/services/shortcuts/registry/index.ts

// ═══════════════════════════════════════════════════════════════
// 📤 BARREL: exports públicos del registry de shortcuts
// ═══════════════════════════════════════════════════════════════

/*
 * NO exporta directamente `bootstrap` — el bootstrap es una función
 * que necesita el store, y se llama explícitamente desde AppProviders.
 * Se expone `bootstrapShortcuts` como función named.
 */

export type {
  ShortcutRegistration,
  ShortcutCtx,
  GlobalShortcut,
  TypedStore,
} from './shortcuts.types';

export { shortcutsRegistry } from './shortcutsRegistry';

export { bootstrapShortcuts } from './bootstrap';