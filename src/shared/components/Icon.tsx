/**
 * Icon.tsx — Bridge de compatibilidad
 * ------------------------------------
 * Este archivo se mantiene solo para no romper imports antiguos:
 *   import { Icon } from '@shared/components/Icon';
 *
 * Reexporta el nuevo componente del sistema modular en ./icons/.
 *
 * ⚠️ Para código NUEVO, prefiere el import directo:
 *   import { PlayIcon } from '@shared/components/icons';
 */
export { Icon } from './icons/Icon';
export type { IconProps, IconName } from './icons/types';