// src/audio/graph/registries/TrackRegistry.ts

import { TrackAudioNode } from '../TrackAudioNode';
import { getRoutingErrorMessage } from '../routing.types';

export interface TrackRegistryCallbacks {
  log(msg: string, level?: 'info' | 'warn' | 'error'): void;
}

/**
 * TrackRegistry
 * -------------
 * Gestiona el ciclo de vida de los TrackAudioNode.
 *
 * NO conoce routing entre entidades — solo crea, guarda y dispone tracks.
 * El caller (RoutingGraph) se encarga de:
 * - Conectar la track a su destino inicial
 * - Reencaminar sends cuando la track se elimina
 */
export class TrackRegistry {
  private readonly _ctx: AudioContext;
  private readonly _callbacks: TrackRegistryCallbacks;
  private readonly _tracks = new Map<string, TrackAudioNode>();
  private _idsCache: readonly string[] | null = null;

  constructor(ctx: AudioContext, callbacks: TrackRegistryCallbacks) {
    this._ctx = ctx;
    this._callbacks = callbacks;
  }

  /**
   * Crea (o devuelve la existente) una track.
   * NO la conecta a ningún destino — el caller debe hacerlo.
   */
  public create(id: string): { track: TrackAudioNode; wasCreated: boolean } {
    const existing = this._tracks.get(id);
    if (existing) return { track: existing, wasCreated: false };

    const track = new TrackAudioNode(id, this._ctx);
    this._tracks.set(id, track);
    this._invalidateCache();

    return { track, wasCreated: true };
  }

  public get(id: string): TrackAudioNode | null {
    return this._tracks.get(id) ?? null;
  }

  public has(id: string): boolean {
    return this._tracks.has(id);
  }

  /**
   * Elimina una track y la dispone. Devuelve true si existía.
   * NO limpia sends ni routing — el caller debe hacerlo antes.
   */
  public remove(id: string): boolean {
    const track = this._tracks.get(id);
    if (!track) return false;

    try {
      track.dispose();
    } catch (err) {
      this._callbacks.log(
        `Error al disposear track ${id}: ${getRoutingErrorMessage(err)}`,
        'warn'
      );
    }

    this._tracks.delete(id);
    this._invalidateCache();
    return true;
  }

  public getAllIds(): readonly string[] {
    if (this._idsCache === null) {
      this._idsCache = Object.freeze(Array.from(this._tracks.keys()));
    }
    return this._idsCache;
  }

  public getAll(): readonly TrackAudioNode[] {
    return Array.from(this._tracks.values());
  }

  public get size(): number {
    return this._tracks.size;
  }

  /**
   * Dispone todas las tracks. Usado por RoutingGraph.dispose().
   */
  public disposeAll(): void {
    for (const [id, track] of this._tracks) {
      try {
        track.dispose();
      } catch (err) {
        this._callbacks.log(
          `Error al disposear track ${id}: ${getRoutingErrorMessage(err)}`,
          'warn'
        );
      }
    }
    this._tracks.clear();
    this._invalidateCache();
  }

  private _invalidateCache(): void {
    this._idsCache = null;
  }
}