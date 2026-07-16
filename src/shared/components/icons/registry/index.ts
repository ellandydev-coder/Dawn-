// src/shared/components/icons/registry/index.ts

// ═══════════════════════════════════════════════════════════════
// 📤 BARREL: exports públicos del registry de icons
// ═══════════════════════════════════════════════════════════════

/*
 * NO exporta `bootstrap.ts` — ese solo se importa desde main.tsx
 * porque tiene efecto secundario (descubre y registra iconos).
 */

export type {
  IconEntry,
  IconCategory,
  IconComponent,
} from './icons.types';

export {
  iconsRegistry,
  resolveIcon,
  getIconsByCategory,
} from './iconsRegistry';

export { IconIds } from './iconIds';