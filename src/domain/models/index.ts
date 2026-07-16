/**
 * Barrel export de todos los modelos del dominio.
 * 
 * Uso:
 *   import { Track, Clip, Asset } from '@domain/models';
 */

// Tier 1 - Críticos
export * from './Track';
export * from './Clip';
export * from './Asset';
export * from './Project';
export * from './MixerChannel';

// Tier 2 - Importantes
export * from './MIDINote';
export * from './MIDIClip';
export * from './AutomationLane';
export * from './Effect';
export * from './Send';
export * from './Selection';
export * from './TimeSignature';

// Tier 3 - Placeholders (aún vacíos)
export * from './Bus';
export * from './Marker';
export * from './Region';
export * from './RoutingMatrix';
export * from './Take';
export * from './Tempo';
export * from './TempoMap';