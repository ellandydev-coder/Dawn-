// src/features/preferences/registry/index.ts

// ═══════════════════════════════════════════════════════════════
// 📤 BARREL: exports públicos del registry de Preferences
// ═══════════════════════════════════════════════════════════════

/*
 * Este barrel expone los tipos y el registry para que el resto de
 * la feature (sidebar, content, panels individuales) los consuma.
 *
 * NO exporta `bootstrap.ts` — ese solo se importa desde main.tsx
 * porque tiene efecto secundario (descubre y registra panels).
 */

export type {
  PreferencePanelEntry,
  PreferencePanelComponent,
  PreferencePanelComponentProps,
  PreferencePanelDefaults,
  PreferencesStateShape,
} from './preferences.types';

export { preferencesRegistry } from './preferencesRegistry';