// src/audio/graph/registries/SendRegistry.ts

import { SendReturnNode, type SendReturnNodeConfig } from '../SendReturnNode';
import {
  type SendMetadata,
  type SendRemovalReason,
  getRoutingErrorMessage,
} from '../routing.types';

export interface SendRegistryCallbacks {
  log(msg: string, level?: 'info' | 'warn' | 'error'): void;
  onSendRemoved(sendId: string, reason: SendRemovalReason): void;
}

export interface CreateSendParams {
  sendId: string;
  sourceId: string;
  destinationId: string;
  preFader: boolean;
  sourceNode: AudioNode;
  destinationNode: AudioNode;
  config?: Partial<SendReturnNodeConfig>;
}

/**
 * SendRegistry
 * ------------
 * Gestiona el ciclo de vida de los SendReturnNode + metadata asociada.
 *
 * Metadata (`sourceId`, `destinationId`, `preFader`) sobrevive al nodo
 * y se usa para reruteo tras cambios en el grafo.
 *
 * NO resuelve nodos (source/destination) — el caller debe pasarlos ya
 * resueltos. NO valida loops — el caller usa LoopDetector.
 */
export class SendRegistry {
  private readonly _ctx: AudioContext;
  private readonly _callbacks: SendRegistryCallbacks;
  private readonly _sends = new Map<string, SendReturnNode>();
  private readonly _metadata = new Map<string, SendMetadata>();
  private _idsCache: readonly string[] | null = null;

  constructor(ctx: AudioContext, callbacks: SendRegistryCallbacks) {
    this._ctx = ctx;
    this._callbacks = callbacks;
  }

  /**
   * Crea un send y lo registra con metadata.
   * Lanza si el sendId ya existe.
   */
  public create(params: CreateSendParams): SendReturnNode {
    const {
      sendId,
      sourceId,
      destinationId,
      preFader,
      sourceNode,
      destinationNode,
      config = {},
    } = params;

    if (this._sends.has(sendId)) {
      throw new Error(`[SendRegistry] Send "${sendId}" ya existe`);
    }

    const sendNode = new SendReturnNode(
      sendId,
      this._ctx,
      sourceNode,
      destinationNode,
      { preFader, ...config }
    );

    this._sends.set(sendId, sendNode);
    this._metadata.set(sendId, { sourceId, destinationId, preFader });
    this._invalidateCache();

    return sendNode;
  }

  public get(sendId: string): SendReturnNode | null {
    return this._sends.get(sendId) ?? null;
  }

  public getMetadata(sendId: string): SendMetadata | null {
    return this._metadata.get(sendId) ?? null;
  }

  public has(sendId: string): boolean {
    return this._sends.has(sendId);
  }

  /**
   * Elimina un send, lo dispone y emite el evento correspondiente.
   * Devuelve true si existía.
   */
  public remove(sendId: string, reason: SendRemovalReason): boolean {
    const send = this._sends.get(sendId);
    if (!send) return false;

    try {
      send.dispose();
    } catch (err) {
      this._callbacks.log(
        `Error al disposear send ${sendId}: ${getRoutingErrorMessage(err)}`,
        'warn'
      );
    }

    this._sends.delete(sendId);
    this._metadata.delete(sendId);
    this._invalidateCache();

    this._callbacks.onSendRemoved(sendId, reason);
    return true;
  }

  /**
   * Elimina todos los sends donde `entityId` sea source o destination.
   * Devuelve los IDs eliminados.
   */
  public removeInvolving(
    entityId: string,
    reason: SendRemovalReason
  ): readonly string[] {
    const toRemove: string[] = [];
    for (const [sendId, meta] of this._metadata) {
      if (meta.sourceId === entityId || meta.destinationId === entityId) {
        toRemove.push(sendId);
      }
    }

    for (const sendId of toRemove) {
      this.remove(sendId, reason);
    }

    return toRemove;
  }

  /**
   * Actualiza el flag preFader en la metadata.
   * NO reconecta el nodo — el caller debe llamar `send.reconnectSource()`.
   */
  public updatePreFader(sendId: string, preFader: boolean): boolean {
    const meta = this._metadata.get(sendId);
    if (!meta) return false;

    meta.preFader = preFader;
    return true;
  }

  /**
   * Actualiza el destinationId en la metadata.
   * NO reconecta el nodo — el caller debe llamar `send.reconnectDestination()`.
   */
  public updateDestination(sendId: string, destinationId: string): boolean {
    const meta = this._metadata.get(sendId);
    if (!meta) return false;

    meta.destinationId = destinationId;
    return true;
  }

  public getAllIds(): readonly string[] {
    if (this._idsCache === null) {
      this._idsCache = Object.freeze(Array.from(this._sends.keys()));
    }
    return this._idsCache;
  }

  public get size(): number {
    return this._sends.size;
  }

  /**
   * Dispone todos los sends. Usado por RoutingGraph.dispose().
   * Emite `onSendRemoved` con reason='dispose' para cada uno.
   */
  public disposeAll(): void {
    const ids = Array.from(this._sends.keys());
    for (const sendId of ids) {
      this.remove(sendId, 'dispose');
    }
  }

  private _invalidateCache(): void {
    this._idsCache = null;
  }
}