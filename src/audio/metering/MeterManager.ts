/**
 * MeterManager
 * ------------
 * Singleton que gestiona todos los AudioWorkletNode de metering.
 *
 * ARQUITECTURA:
 *  - Un meter node por cada track (y uno para master)
 *  - Recibe mensajes de cada worklet via port.onmessage
 *  - Distribuye a los suscriptores (hooks React) via pub/sub
 *  - Broadcast loop con RAF (60 FPS sincronizado con repaint)
 *
 * ⚠️ CRÍTICO: NO pasamos los datos por Redux.
 * A 60 FPS × 20 tracks = 1200 dispatches/segundo → colapsaría el store.
 * En su lugar, usamos pub/sub directo con requestAnimationFrame.
 */

import meterProcessorUrl from '@audio/worklets/processors/MeterProcessor.ts?worker&url';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS PÚBLICOS
// ═══════════════════════════════════════════════════════════════

export interface MeterData {
  /** Peak absoluto (0–1+, puede exceder 1 si hay clipping) */
  peak: number;
  /** RMS (volumen percibido, 0–1) */
  rms: number;
  /** Peak sostenido que decae lentamente */
  peakHold: number;
  /** true si peak >= CLIP_THRESHOLD (con hold temporal) */
  clipping: boolean;
}

export type MeterCallback = (data: MeterData) => void;

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

/** Decaimiento del peak hold por frame de RAF (~60 FPS) */
const PEAK_HOLD_DECAY = 0.005;

/** Umbral a partir del cual se considera clipping */
const CLIP_THRESHOLD = 0.99;

/** Duración del indicador de clip antes de auto-reset (ms) */
const CLIP_HOLD_MS = 1000;

/** Nombre del processor registrado en el AudioWorklet */
const WORKLET_PROCESSOR_NAME = 'meter-processor';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS INTERNOS
// ═══════════════════════════════════════════════════════════════

interface WorkletMeterMessage {
  type: 'meter';
  peak: number;
  rms: number;
  channels: number;
}

const DEFAULT_METER_DATA: Readonly<MeterData> = Object.freeze({
  peak: 0,
  rms: 0,
  peakHold: 0,
  clipping: false,
});

// ═══════════════════════════════════════════════════════════════
// 🎯 IMPLEMENTACIÓN
// ═══════════════════════════════════════════════════════════════

class MeterManagerImpl {
  private readonly _nodes = new Map<string, AudioWorkletNode>();
  private readonly _latest = new Map<string, MeterData>();
  private readonly _subscribers = new Map<string, Set<MeterCallback>>();
  private readonly _clipTimestamps = new Map<string, number>();

  private _workletLoaded = false;
  private _loadingPromise: Promise<void> | null = null;
  private _rafId: number | null = null;

  // ═══════════════════════════════════
  // Lifecycle
  // ═══════════════════════════════════

  /**
   * Carga el módulo del worklet (idempotente y concurrency-safe).
   * Múltiples llamadas simultáneas reutilizan la misma Promise.
   */
  public async loadWorklet(context: AudioContext): Promise<void> {
    if (this._workletLoaded) return;

    // Evita race condition si se llama varias veces antes de resolver
    if (this._loadingPromise) return this._loadingPromise;

    this._loadingPromise = context.audioWorklet
      .addModule(meterProcessorUrl)
      .then(() => {
        this._workletLoaded = true;
        this._loadingPromise = null;
        this._startBroadcastLoop();
        console.info('[MeterManager] Worklet cargado:', meterProcessorUrl);
      })
      .catch((err: unknown) => {
        this._loadingPromise = null;
        const message =
          err instanceof Error ? err.message : String(err);
        throw new Error(
          `[MeterManager] No se pudo cargar el AudioWorklet. ` +
          `URL: ${meterProcessorUrl}. Causa: ${message}`
        );
      });

    return this._loadingPromise;
  }

  /**
   * Crea un meter node para un ID (trackId o "master").
   * Devuelve el nodo para que el llamador lo conecte al grafo.
   * Idempotente: reutiliza el nodo si ya existe.
   */
  public createMeter(id: string, context: AudioContext): AudioWorkletNode {
    const existing = this._nodes.get(id);
    if (existing) return existing;

    if (!this._workletLoaded) {
      throw new Error(
        '[MeterManager] Worklet no cargado. Llama a loadWorklet() primero.'
      );
    }

    const node = new AudioWorkletNode(context, WORKLET_PROCESSOR_NAME, {
      numberOfInputs: 1,
      numberOfOutputs: 1,
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
    });

    this._latest.set(id, { ...DEFAULT_METER_DATA });

    node.port.onmessage = (event: MessageEvent<WorkletMeterMessage>) => {
      const msg = event.data;
      if (msg?.type !== 'meter') return;
      this._updateLatest(id, msg.peak, msg.rms);
    };

    // Guard ante errores del worklet (ej: OOM, exception en processor)
    node.onprocessorerror = (event: Event) => {
      console.error(
        `[MeterManager] Error en processor del meter "${id}":`,
        event
      );
    };

    this._nodes.set(id, node);
    return node;
  }

  /**
   * Elimina el meter node y limpia todos sus recursos.
   * Llamar al eliminar una track.
   */
  public removeMeter(id: string): void {
    const node = this._nodes.get(id);
    if (node) {
      node.port.onmessage = null;
      node.onprocessorerror = null;
      try {
        node.disconnect();
      } catch {
        // Ignorar si ya estaba desconectado
      }
      this._nodes.delete(id);
    }

    this._latest.delete(id);
    this._subscribers.delete(id);
    this._clipTimestamps.delete(id);
  }

  // ═══════════════════════════════════
  // Pub/Sub
  // ═══════════════════════════════════

  /**
   * Suscribe un callback a los datos de un meter.
   * Envía el último valor conocido inmediatamente.
   *
   * @returns Función de unsubscribe
   *
   * @example
   * const unsub = MeterManager.subscribe(trackId, (data) => {
   *   setLevel(data.rms);
   * });
   * return unsub; // en cleanup de useEffect
   */
  public subscribe(id: string, callback: MeterCallback): () => void {
    let subs = this._subscribers.get(id);
    if (!subs) {
      subs = new Set();
      this._subscribers.set(id, subs);
    }
    subs.add(callback);

    // Enviar último valor conocido inmediatamente (evita flash vacío)
    const latest = this._latest.get(id);
    if (latest) {
      try {
        callback(latest);
      } catch (err) {
        console.error(`[MeterManager] Error en callback de "${id}":`, err);
      }
    }

    return () => {
      this._subscribers.get(id)?.delete(callback);
    };
  }

  /**
   * Obtiene los datos actuales de un meter sin suscribirse.
   * Retorna DEFAULT_METER_DATA si el id no existe.
   */
  public getData(id: string): MeterData {
    return this._latest.get(id) ?? { ...DEFAULT_METER_DATA };
  }

  /**
   * Resetea manualmente el indicador de clipping de un meter.
   * Útil cuando el usuario hace click en el clip indicator de la UI.
   */
  public resetClipping(id: string): void {
    const data = this._latest.get(id);
    if (!data) return;

    this._latest.set(id, { ...data, clipping: false });
    this._clipTimestamps.delete(id);
  }

  // ═══════════════════════════════════
  // Interno
  // ═══════════════════════════════════

  private _updateLatest(id: string, peak: number, rms: number): void {
    const prev = this._latest.get(id);
    if (!prev) return;

    // Peak hold: sube instantáneamente, decae gradualmente
    const newPeakHold =
      peak > prev.peakHold
        ? peak
        : Math.max(0, prev.peakHold - PEAK_HOLD_DECAY);

    // Clipping con hold temporal
    let clipping = prev.clipping;
    const now = performance.now();

    if (peak >= CLIP_THRESHOLD) {
      clipping = true;
      this._clipTimestamps.set(id, now);
    } else if (clipping) {
      const clipStart = this._clipTimestamps.get(id) ?? 0;
      if (now - clipStart > CLIP_HOLD_MS) {
        clipping = false;
        this._clipTimestamps.delete(id);
      }
    }

    this._latest.set(id, { peak, rms, peakHold: newPeakHold, clipping });
  }

  /**
   * Loop de broadcast a 60 FPS sincronizado con el repaint.
   * Notifica a todos los suscriptores con los datos más recientes.
   */
  private _startBroadcastLoop(): void {
    if (this._rafId !== null) return; // Evitar loops duplicados

    const tick = (): void => {
      for (const [id, callbacks] of this._subscribers) {
        if (callbacks.size === 0) continue;

        const data = this._latest.get(id);
        if (!data) continue;

        for (const cb of callbacks) {
          try {
            cb(data);
          } catch (err) {
            console.error(
              `[MeterManager] Error en subscriber de "${id}":`,
              err
            );
          }
        }
      }

      this._rafId = requestAnimationFrame(tick);
    };

    this._rafId = requestAnimationFrame(tick);
  }

  private _stopBroadcastLoop(): void {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  /**
   * Limpia todos los recursos.
   * Llamar al cerrar el AudioContext o al hacer hot-reload en dev.
   */
  public dispose(): void {
    this._stopBroadcastLoop();

    for (const id of Array.from(this._nodes.keys())) {
      this.removeMeter(id);
    }

    this._nodes.clear();
    this._latest.clear();
    this._subscribers.clear();
    this._clipTimestamps.clear();
    this._workletLoaded = false;
    this._loadingPromise = null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 🎯 SINGLETON EXPORT
// ═══════════════════════════════════════════════════════════════

export const MeterManager = new MeterManagerImpl();