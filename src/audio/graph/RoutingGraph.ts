// src/audio/graph/RoutingGraph.ts

import { TrackAudioNode } from './TrackAudioNode';
import { BusNode, type BusNodeConfig } from './BusNode';
import { MasterBus } from './MasterBus';
import { SendReturnNode, type SendReturnNodeConfig } from './SendReturnNode';
import type { Send } from '@domain/models/Send';

import {
  type RoutingGraphConfig,
  type RoutingGraphStats,
  type RoutingTarget,
  type RoutingGraphEvent,
  type RoutingGraphListener,
  ROUTING_DEFAULT_CONFIG,
  toRoutingError,
} from './routing.types';
import {
  wouldBusRoutingCreateLoop,
  wouldSendCreateLoop,
} from './LoopDetector';
import { TrackRegistry } from './registries/TrackRegistry';
import { BusRegistry } from './registries/BusRegistry';
import { SendRegistry } from './registries/SendRegistry';

export type {
  RoutingGraphConfig,
  RoutingGraphStats,
  RoutingTarget,
  RoutingGraphEvent,
  RoutingGraphListener,
};

/**
 * RoutingGraph
 * ------------
 * Orquestador del grafo de audio del proyecto.
 *
 * Delega el ciclo de vida a 3 registries:
 * - TrackRegistry → TrackAudioNode
 * - BusRegistry   → BusNode
 * - SendRegistry  → SendReturnNode + metadata
 *
 * Delega la detección de loops a `LoopDetector` (funciones puras).
 *
 * Responsabilidades propias:
 * - Enrutar tracks/buses al master o a otros buses
 * - Coordinar reruteo tras eliminación de entidades
 * - Emitir eventos de cambios
 *
 * NO maneja:
 * - Estado de UI (Redux)
 * - Volúmenes/pan (cada nodo)
 * - Reproducción (TransportScheduler)
 * - MasterBus: es propiedad de AudioEngine, se inyecta.
 */
export class RoutingGraph {
  private readonly _ctx: AudioContext;
  private readonly _masterBus: MasterBus;
  private readonly _config: Required<RoutingGraphConfig>;

  // ── Registries ───────────────────────────────────────
  private readonly _trackRegistry: TrackRegistry;
  private readonly _busRegistry: BusRegistry;
  private readonly _sendRegistry: SendRegistry;

  // ── Ruteo actual ─────────────────────────────────────
  private readonly _trackRouting = new Map<string, string>();
  private readonly _busRouting = new Map<string, string>();

  // ── Eventos ──────────────────────────────────────────
  private readonly _listeners = new Set<RoutingGraphListener>();

  private _isDisposed = false;

  constructor(
    ctx: AudioContext,
    masterBus: MasterBus,
    config: RoutingGraphConfig = {}
  ) {
    this._ctx = ctx;
    this._masterBus = masterBus;
    this._config = { ...ROUTING_DEFAULT_CONFIG, ...config };

    const logCallback = (
      msg: string,
      level: 'info' | 'warn' | 'error' = 'info'
    ) => this._log(msg, level);

    this._trackRegistry = new TrackRegistry(ctx, { log: logCallback });
    this._busRegistry = new BusRegistry(
      ctx,
      { log: logCallback },
      masterBus.id
    );
    this._sendRegistry = new SendRegistry(ctx, {
      log: logCallback,
      onSendRemoved: (sendId, reason) => {
        this._emit({ type: 'sendRemoved', sendId, reason });
        if (reason !== 'dispose') {
          this._log(`Send eliminado: ${sendId} (${reason})`);
        }
      },
    });

    this._log(`Inicializado (master="${masterBus.id}")`);
  }

  // ═══════════════════════════════════════════
  // Tracks
  // ═══════════════════════════════════════════

  public createTrack(id: string): TrackAudioNode {
    this._assertNotDisposed();

    try {
      const { track, wasCreated } = this._trackRegistry.create(id);

      if (wasCreated) {
        track.connect(this._masterBus.input);
        this._trackRouting.set(id, this._masterBus.id);
        this._emit({ type: 'trackCreated', trackId: id });
        this._log(`Track creada: ${id} → ${this._masterBus.id}`);
      }

      return track;
    } catch (err) {
      const error = toRoutingError(err);
      this._log(`Error al crear track ${id}: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
      throw error;
    }
  }

  public getTrack(id: string): TrackAudioNode | null {
    return this._trackRegistry.get(id);
  }

  public hasTrack(id: string): boolean {
    return this._trackRegistry.has(id);
  }

  public removeTrack(id: string): void {
    if (!this._trackRegistry.has(id)) return;

    try {
      this._sendRegistry.removeInvolving(id, 'sourceRemoved');
      this._trackRegistry.remove(id);
      this._trackRouting.delete(id);
      this._emit({ type: 'trackRemoved', trackId: id });
      this._log(`Track eliminada: ${id}`);
    } catch (err) {
      const error = toRoutingError(err);
      this._log(`Error al eliminar track ${id}: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
    }
  }

  public getAllTrackIds(): readonly string[] {
    return this._trackRegistry.getAllIds();
  }

  public getAllTracks(): readonly TrackAudioNode[] {
    return this._trackRegistry.getAll();
  }

  // ═══════════════════════════════════════════
  // Buses
  // ═══════════════════════════════════════════

  public createBus(id: string, config: BusNodeConfig = {}): BusNode {
    this._assertNotDisposed();

    try {
      const { bus, wasCreated } = this._busRegistry.create(id, {
        verbose: this._config.verbose,
        ...config,
      });

      if (wasCreated) {
        bus.connect(this._masterBus.input);
        this._busRouting.set(id, this._masterBus.id);
        this._emit({ type: 'busCreated', busId: id });
        this._log(`Bus creado: ${id} → ${this._masterBus.id}`);
      }

      return bus;
    } catch (err) {
      const error = toRoutingError(err);
      this._log(`Error al crear bus ${id}: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
      throw error;
    }
  }

  public getBus(id: string): BusNode | null {
    if (id === this._masterBus.id) return this._masterBus;
    return this._busRegistry.get(id);
  }

  public hasBus(id: string): boolean {
    return id === this._masterBus.id || this._busRegistry.has(id);
  }

  public removeBus(id: string): void {
    if (id === this._masterBus.id) {
      this._log('No se puede eliminar el master bus', 'warn');
      return;
    }

    if (!this._busRegistry.has(id)) return;

    try {
      // 1. Reencaminar tracks que apunten a este bus → master
      this._trackRouting.forEach((targetId, trackId) => {
        if (targetId === id) this.routeTrack(trackId, this._masterBus.id);
      });

      // 2. Reencaminar buses hijos que apunten a este bus → master
      this._busRouting.forEach((targetId, busId) => {
        if (targetId === id) this.routeBus(busId, this._masterBus.id);
      });

      // 3. Limpiar sends donde este bus sea source o destination
      this._sendRegistry.removeInvolving(id, 'destinationRemoved');

      // 4. Dispose del bus
      this._busRegistry.remove(id);
      this._busRouting.delete(id);

      this._emit({ type: 'busRemoved', busId: id });
      this._log(`Bus eliminado: ${id}`);
    } catch (err) {
      const error = toRoutingError(err);
      this._log(`Error al eliminar bus ${id}: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
    }
  }

  public getAllBusIds(): readonly string[] {
    return this._busRegistry.getAllIds();
  }

  public get masterBus(): MasterBus {
    return this._masterBus;
  }

  // ═══════════════════════════════════════════
  // Routing
  // ═══════════════════════════════════════════

  public routeTrack(trackId: string, targetId: string): void {
    this._assertNotDisposed();

    const track = this._trackRegistry.get(trackId);
    if (!track) {
      this._log(`routeTrack: track "${trackId}" no existe`, 'warn');
      return;
    }

    const target = this._resolveRoutingTarget(targetId);
    if (!target) {
      this._log(`routeTrack: destino "${targetId}" no existe`, 'warn');
      return;
    }

    try {
      track.disconnect();
      track.connect(target.node);

      this._trackRouting.set(trackId, targetId);
      this._emit({ type: 'trackRouted', trackId, targetId });
      this._log(`Track "${trackId}" → "${targetId}"`);
    } catch (err) {
      const error = toRoutingError(err);
      this._log(`Error al enrutar track: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
    }
  }

  public routeBus(busId: string, targetId: string): void {
    this._assertNotDisposed();

    if (busId === this._masterBus.id) {
      throw new Error('[RoutingGraph] El master bus no se puede rerutar');
    }
    if (busId === targetId) {
      throw new Error(`[RoutingGraph] Bus "${busId}" no se puede rutear a sí mismo`);
    }

    const bus = this._busRegistry.get(busId);
    if (!bus) {
      this._log(`routeBus: bus "${busId}" no existe`, 'warn');
      return;
    }

    const target = this._resolveRoutingTarget(targetId);
    if (!target) {
      this._log(`routeBus: destino "${targetId}" no existe`, 'warn');
      return;
    }

    if (wouldBusRoutingCreateLoop(
      busId,
      targetId,
      this._masterBus.id,
      this._busRouting
    )) {
      const error = new Error(
        `[RoutingGraph] Loop detectado: "${busId}" → "${targetId}" cerraría un ciclo`
      );
      this._log(error.message, 'error');
      this._emit({ type: 'error', error });
      throw error;
    }

    try {
      bus.disconnect();
      bus.connect(target.node);

      this._busRouting.set(busId, targetId);
      this._emit({ type: 'busRouted', busId, targetId });
      this._log(`Bus "${busId}" → "${targetId}"`);
    } catch (err) {
      const error = toRoutingError(err);
      this._log(`Error al enrutar bus: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
    }
  }

  public getTrackRouting(trackId: string): string | null {
    return this._trackRouting.get(trackId) ?? null;
  }

  public getBusRouting(busId: string): string | null {
    if (busId === this._masterBus.id) return null;
    return this._busRouting.get(busId) ?? null;
  }

  private _resolveRoutingTarget(targetId: string): RoutingTarget | null {
    if (targetId === this._masterBus.id) {
      return {
        id: this._masterBus.id,
        kind: 'master',
        node: this._masterBus.input,
      };
    }
    const bus = this._busRegistry.get(targetId);
    if (bus) {
      return { id: targetId, kind: 'bus', node: bus.input };
    }
    return null;
  }

  // ═══════════════════════════════════════════
  // Sends
  // ═══════════════════════════════════════════

  public createSend(
    send: Send,
    options: Partial<SendReturnNodeConfig> = {}
  ): SendReturnNode {
    this._assertNotDisposed();

    // Resolver source (track o bus, NO master)
    const sourceNode = this._resolveSendSource(
      send.sourceTrackId,
      send.preFader
    );
    if (!sourceNode) {
      throw new Error(
        `[RoutingGraph] Source "${send.sourceTrackId}" no existe (esperado track o bus, no master)`
      );
    }

    // Resolver destination (bus o master)
    const destTarget = this._resolveRoutingTarget(send.destinationBusId);
    if (!destTarget) {
      throw new Error(
        `[RoutingGraph] Destination "${send.destinationBusId}" no existe`
      );
    }

    // Loop detection
    if (wouldSendCreateLoop(
      send.sourceTrackId,
      send.destinationBusId,
      this._masterBus.id,
      this._busRouting
    )) {
      throw new Error(
        `[RoutingGraph] Send crearía loop: ` +
        `"${send.sourceTrackId}" → send → "${send.destinationBusId}" → ... → "${send.sourceTrackId}"`
      );
    }

    try {
      const sendNode = this._sendRegistry.create({
        sendId: send.id,
        sourceId: send.sourceTrackId,
        destinationId: send.destinationBusId,
        preFader: send.preFader,
        sourceNode,
        destinationNode: destTarget.node,
        config: {
          amount: send.amount,
          pan: send.pan,
          muted: send.muted,
          verbose: this._config.verbose,
          ...options,
        },
      });

      this._emit({
        type: 'sendCreated',
        sendId: send.id,
        sourceId: send.sourceTrackId,
        destinationId: send.destinationBusId,
      });
      this._log(
        `Send creado: ${send.id} (${send.sourceTrackId} → ${send.destinationBusId}, ` +
        `${send.preFader ? 'pre' : 'post'}-fader)`
      );

      return sendNode;
    } catch (err) {
      const error = toRoutingError(err);
      this._log(`Error al crear send: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
      throw error;
    }
  }

  public getSend(sendId: string): SendReturnNode | null {
    return this._sendRegistry.get(sendId);
  }

  public hasSend(sendId: string): boolean {
    return this._sendRegistry.has(sendId);
  }

  public removeSend(sendId: string): void {
    this._sendRegistry.remove(sendId, 'manual');
  }

  public setSendPreFader(sendId: string, preFader: boolean): void {
    this._assertNotDisposed();

    const send = this._sendRegistry.get(sendId);
    const meta = this._sendRegistry.getMetadata(sendId);
    if (!send || !meta) {
      this._log(`setSendPreFader: send "${sendId}" no existe`, 'warn');
      return;
    }
    if (meta.preFader === preFader) return;

    const newSource = this._resolveSendSource(meta.sourceId, preFader);
    if (!newSource) {
      this._log(
        `setSendPreFader: source "${meta.sourceId}" no disponible`,
        'warn'
      );
      return;
    }

    try {
      send.setPreFader(preFader);
      send.reconnectSource(newSource);
      this._sendRegistry.updatePreFader(sendId, preFader);
      this._emit({ type: 'sendReconnected', sendId });
      this._log(`Send ${sendId} → ${preFader ? 'pre' : 'post'}-fader`);
    } catch (err) {
      const error = toRoutingError(err);
      this._log(`Error al cambiar preFader: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
    }
  }

  public setSendDestination(sendId: string, destinationBusId: string): void {
    this._assertNotDisposed();

    const send = this._sendRegistry.get(sendId);
    const meta = this._sendRegistry.getMetadata(sendId);
    if (!send || !meta) {
      this._log(`setSendDestination: send "${sendId}" no existe`, 'warn');
      return;
    }
    if (meta.destinationId === destinationBusId) return;

    const newTarget = this._resolveRoutingTarget(destinationBusId);
    if (!newTarget) {
      this._log(
        `setSendDestination: destino "${destinationBusId}" no existe`,
        'warn'
      );
      return;
    }

    if (wouldSendCreateLoop(
      meta.sourceId,
      destinationBusId,
      this._masterBus.id,
      this._busRouting
    )) {
      const error = new Error(
        `[RoutingGraph] Cambio de destino crearía loop: ` +
        `"${meta.sourceId}" → "${destinationBusId}"`
      );
      this._log(error.message, 'error');
      this._emit({ type: 'error', error });
      throw error;
    }

    try {
      send.reconnectDestination(newTarget.node);
      this._sendRegistry.updateDestination(sendId, destinationBusId);
      this._emit({ type: 'sendReconnected', sendId });
      this._log(`Send ${sendId} → destino ${destinationBusId}`);
    } catch (err) {
      const error = toRoutingError(err);
      this._log(`Error al cambiar destino: ${error.message}`, 'error');
      this._emit({ type: 'error', error });
    }
  }

  public getAllSendIds(): readonly string[] {
    return this._sendRegistry.getAllIds();
  }

  /**
   * Resuelve el source de un send: acepta track o bus (NO master).
   */
  private _resolveSendSource(
    sourceId: string,
    preFader: boolean
  ): AudioNode | null {
    if (sourceId === this._masterBus.id) return null;

    const track = this._trackRegistry.get(sourceId);
    if (track) return track.getSendSource(preFader);

    const bus = this._busRegistry.get(sourceId);
    if (bus) return bus.getSendSource(preFader);

    return null;
  }

  // ═══════════════════════════════════════════
  // Eventos
  // ═══════════════════════════════════════════

  public on(listener: RoutingGraphListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  private _emit(event: RoutingGraphEvent): void {
    const snapshot = Array.from(this._listeners);
    for (const listener of snapshot) {
      try {
        listener(event);
      } catch (err) {
        console.error('[RoutingGraph] Error en listener:', err);
      }
    }
  }

  // ═══════════════════════════════════════════
  // Stats
  // ═══════════════════════════════════════════

  public getStats(): RoutingGraphStats {
    return {
      trackCount: this._trackRegistry.size,
      busCount: this._busRegistry.size,
      sendCount: this._sendRegistry.size,
      isDisposed: this._isDisposed,
      masterId: this._masterBus.id,
    };
  }

  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  public get trackCount(): number {
    return this._trackRegistry.size;
  }

  public get busCount(): number {
    return this._busRegistry.size;
  }

  public get sendCount(): number {
    return this._sendRegistry.size;
  }

  public get context(): AudioContext {
    return this._ctx;
  }

  // ═══════════════════════════════════════════
  // Cleanup
  // ═══════════════════════════════════════════

  /**
   * Destruye el grafo completo.
   * NO dispone el MasterBus (es propiedad de AudioEngine).
   */
  public dispose(): void {
    if (this._isDisposed) return;

    try {
      // 1. Sends primero (dependen de tracks/buses)
      this._sendRegistry.disposeAll();

      // 2. Tracks
      this._trackRegistry.disposeAll();
      this._trackRouting.clear();

      // 3. Buses (NO el master — es del engine)
      this._busRegistry.disposeAll();
      this._busRouting.clear();

      this._isDisposed = true;
      this._emit({ type: 'disposed' });
      this._listeners.clear();

      this._log('Disposed');
    } catch (err) {
      const error = toRoutingError(err);
      this._log(`Error en dispose: ${error.message}`, 'error');
    }
  }

  // ═══════════════════════════════════════════
  // Internos
  // ═══════════════════════════════════════════

  private _assertNotDisposed(): void {
    if (this._isDisposed) {
      throw new Error('[RoutingGraph] El grafo ya fue disposed');
    }
  }

  private _log(msg: string, level: 'info' | 'warn' | 'error' = 'info'): void {
    if (!this._config.verbose && level === 'info') return;

    const prefix = '[RoutingGraph]';
    switch (level) {
      case 'error': console.error(prefix, msg); break;
      case 'warn':  console.warn(prefix, msg);  break;
      default:      console.info(prefix, msg);
    }
  }
}
