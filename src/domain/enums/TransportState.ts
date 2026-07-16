/**
 * TransportState
 * --------------
 * Estados del transporte de reproducción.
 */

export const TransportState = {
  STOPPED:   'stopped',
  PLAYING:   'playing',
  PAUSED:    'paused',
  RECORDING: 'recording',
} as const;

export type TransportState = typeof TransportState[keyof typeof TransportState];

export const ALL_TRANSPORT_STATES = Object.values(TransportState) as [string, ...string[]];

export const isTransportState = (value: unknown): value is TransportState =>
  typeof value === 'string' && ALL_TRANSPORT_STATES.includes(value);

export const TRANSPORT_STATE_LABELS: Record<TransportState, string> = {
  [TransportState.STOPPED]:   'Stopped',
  [TransportState.PLAYING]:   'Playing',
  [TransportState.PAUSED]:    'Paused',
  [TransportState.RECORDING]: 'Recording',
};

export const isTransportActive = (state: TransportState): boolean =>
  state === TransportState.PLAYING || state === TransportState.RECORDING;

export const isTransportIdle = (state: TransportState): boolean =>
  state === TransportState.STOPPED || state === TransportState.PAUSED;

/** Deriva TransportState desde booleans del slice */
export const deriveTransportState = (
  isPlaying: boolean,
  isRecording: boolean
): TransportState => {
  if (isRecording) return TransportState.RECORDING;
  if (isPlaying)   return TransportState.PLAYING;
  return TransportState.STOPPED;
};