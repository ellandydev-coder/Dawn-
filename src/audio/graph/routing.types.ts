// src/audio/graph/routing.types.ts

export interface RoutingGraphConfig {
  /** Habilitar logs en consola (default: true en dev, false en prod) */
  verbose?: boolean;
}

export interface RoutingGraphStats {
  trackCount: number;
  busCount: number;
  sendCount: number;
  isDisposed: boolean;
  masterId: string;
}

export type RoutingEntityKind = 'track' | 'bus' | 'master';

/** Representa un nodo enrutable dentro del grafo */
export interface RoutingTarget {
  id: string;
  kind: RoutingEntityKind;
  node: AudioNode;
}

export type SendRemovalReason =
  | 'manual'
  | 'sourceRemoved'
  | 'destinationRemoved'
  | 'dispose';

export type RoutingGraphEvent =
  | { type: 'trackCreated'; trackId: string }
  | { type: 'trackRemoved'; trackId: string }
  | { type: 'trackRouted'; trackId: string; targetId: string }
  | { type: 'busCreated'; busId: string }
  | { type: 'busRemoved'; busId: string }
  | { type: 'busRouted'; busId: string; targetId: string }
  | { type: 'sendCreated'; sendId: string; sourceId: string; destinationId: string }
  | { type: 'sendRemoved'; sendId: string; reason: SendRemovalReason }
  | { type: 'sendReconnected'; sendId: string }
  | { type: 'disposed' }
  | { type: 'error'; error: Error };

export type RoutingGraphListener = (event: RoutingGraphEvent) => void;

/** Metadata que sobrevive al SendReturnNode (para reruteo) */
export interface SendMetadata {
  sourceId: string;
  destinationId: string;
  preFader: boolean;
}

export const ROUTING_DEFAULT_CONFIG: Required<RoutingGraphConfig> = {
  verbose: import.meta.env?.DEV ?? false,
};

export function toRoutingError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

export function getRoutingErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}