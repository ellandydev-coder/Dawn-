// src/audio/scheduling/SchedulerContext.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 SchedulerContext — Contrato entre el scheduler y su cliente
// ═══════════════════════════════════════════════════════════════

export interface SchedulerClip {
  readonly id: string;
  readonly trackId: string;
  readonly assetId: string | null;
  readonly startTime: number;
  readonly duration: number;
  readonly offset: number;
  readonly gain: number;
  readonly fadeIn: number;
  readonly fadeOut: number;
}

export interface SchedulerLoopState {
  readonly enabled: boolean;
  readonly start: number;
  readonly end: number;
}

export interface SchedulerSnapshot {
  readonly clips: ReadonlyArray<SchedulerClip>;
  readonly loop: SchedulerLoopState;
}

export interface SchedulerContext {
  getSnapshot(): SchedulerSnapshot;
  onPlayheadChange(seconds: number): void;
  getAsset(assetId: string): AudioBuffer | null;

  // ── Tiempo de audio ──────────────────────────────────────────
  getAudioCurrentTime(): number;
  getAudioOutputTime(): number;
  isAudioReady(): boolean;

  // ── Nodos de audio ───────────────────────────────────────────
  /**
   * Devuelve el AudioContext activo.
   * ClipScheduler lo necesita para crear BufferSourceNode y GainNode.
   */
  getAudioContext(): AudioContext;

  /**
   * Devuelve el nodo de entrada de un track en el grafo de routing.
   * Devuelve null si el track no existe o no está conectado.
   */
  getTrackNode(trackId: string): { input: AudioNode } | null;
}