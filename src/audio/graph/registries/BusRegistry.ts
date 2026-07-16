// src/audio/graph/registries/BusRegistry.ts

import { BusNode, type BusNodeConfig } from '../BusNode';
import { getRoutingErrorMessage } from '../routing.types';

export interface BusRegistryCallbacks {
  log(msg: string, level?: 'info' | 'warn' | 'error'): void;
}

/**
 * BusRegistry
 * -----------
 * Gestiona el ciclo de vida de los BusNode (NO incluye master).
 *
 * El master es propiedad de AudioEngine y se inyecta al RoutingGraph.
 * Este registry solo maneja buses regulares.
 */
export class BusRegistry {
  private readonly _ctx: AudioContext;
  private readonly _callbacks: BusRegistryCallbacks;
  private readonly _reservedId: string;
  private readonly _buses = new Map<string, BusNode>();
  private _idsCache: readonly string[] | null = null;

  /**
   * @param ctx        AudioContext compartido
   * @param callbacks  Callbacks al padre (logging)
   * @param reservedId ID del master bus (rechazado por create())
   */
  constructor(
    ctx: AudioContext,
    callbacks: BusRegistryCallbacks,
    reservedId: string
  ) {
    this._ctx = ctx;
    this._callbacks = callbacks;
    this._reservedId = reservedId;
  }

  /**
   * Crea (o devuelve el existente) un bus.
   * Rechaza el ID reservado del master.
   * NO conecta el bus a ningún destino — el caller debe hacerlo.
   */
  public create(
    id: string,
    config: BusNodeConfig = {}
  ): { bus: BusNode; wasCreated: boolean } {
    if (id === this._reservedId) {
      throw new Error(
        `[BusRegistry] No se puede crear un bus con id reservado "${this._reservedId}"`
      );
    }

    const existing = this._buses.get(id);
    if (existing) return { bus: existing, wasCreated: false };

    const bus = new BusNode(id, this._ctx, config);
    this._buses.set(id, bus);
    this._invalidateCache();

    return { bus, wasCreated: true };
  }

  public get(id: string): BusNode | null {
    return this._buses.get(id) ?? null;
  }

  public has(id: string): boolean {
    return this._buses.has(id);
  }

  /**
   * Elimina un bus y lo dispone. Devuelve true si existía.
   * NO reencamina tracks/buses hijos ni limpia sends — el caller debe hacerlo antes.
   */
  public remove(id: string): boolean {
    const bus = this._buses.get(id);
    if (!bus) return false;

    try {
      bus.dispose();
    } catch (err) {
      this._callbacks.log(
        `Error al disposear bus ${id}: ${getRoutingErrorMessage(err)}`,
        'warn'
      );
    }

    this._buses.delete(id);
    this._invalidateCache();
    return true;
  }

  public getAllIds(): readonly string[] {
    if (this._idsCache === null) {
      this._idsCache = Object.freeze(Array.from(this._buses.keys()));
    }
    return this._idsCache;
  }

  public getAll(): readonly BusNode[] {
    return Array.from(this._buses.values());
  }

  public get size(): number {
    return this._buses.size;
  }

  /**
   * Dispone todos los buses regulares (NO el master).
   * Usado por RoutingGraph.dispose().
   */
  public disposeAll(): void {
    for (const [id, bus] of this._buses) {
      try {
        bus.dispose();
      } catch (err) {
        this._callbacks.log(
          `Error al disposear bus ${id}: ${getRoutingErrorMessage(err)}`,
          'warn'
        );
      }
    }
    this._buses.clear();
    this._invalidateCache();
  }

  private _invalidateCache(): void {
    this._idsCache = null;
  }
}