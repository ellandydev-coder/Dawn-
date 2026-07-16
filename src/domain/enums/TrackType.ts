/**
 * TrackType
 * ---------
 * Tipos de pista soportados en la DAW.
 *
 * - AUDIO:  Pista de audio (samples, grabaciones)
 * - MIDI:   Pista MIDI (notas, instrumentos virtuales)
 * - BUS:    Bus de grupo (recibe señal de otras pistas)
 * - AUX:    Auxiliar (para sends de efectos)
 * - MASTER: Pista maestra (salida final)
 */

export const TrackType = {
  AUDIO:  'audio',
  MIDI:   'midi',
  BUS:    'bus',
  AUX:    'aux',
  MASTER: 'master',
} as const;

export type TrackType = typeof TrackType[keyof typeof TrackType];

export const ALL_TRACK_TYPES = Object.values(TrackType) as [string, ...string[]];

export const isTrackType = (value: unknown): value is TrackType =>
  typeof value === 'string' && ALL_TRACK_TYPES.includes(value);

/** Labels legibles para UI */
export const TRACK_TYPE_LABELS: Record<TrackType, string> = {
  [TrackType.AUDIO]:  'Audio',
  [TrackType.MIDI]:   'MIDI',
  [TrackType.BUS]:    'Bus',
  [TrackType.AUX]:    'Aux',
  [TrackType.MASTER]: 'Master',
};

/** ¿Este tipo de track puede recibir audio grabado? */
export const canRecord = (type: TrackType): boolean =>
  type === TrackType.AUDIO || type === TrackType.MIDI;

/** ¿Este tipo de track es de routing (no tiene clips)? */
export const isRoutingTrack = (type: TrackType): boolean =>
  type === TrackType.BUS ||
  type === TrackType.AUX ||
  type === TrackType.MASTER;