/**
 * Barrel export de todos los enums del dominio.
 *
 * Permite imports limpios:
 *   import { TrackType, ClipType } from '@domain/enums';
 *
 * En vez de:
 *   import { TrackType } from '@domain/enums/TrackType';
 *   import { ClipType } from '@domain/enums/ClipType';
 */

export * from './TrackType';
export * from './ClipType';
export * from './TransportState';
export * from './AutomationMode';
export * from './EffectType';
export * from './PanLaw';
export * from './SnapMode';
export * from './ToolType';