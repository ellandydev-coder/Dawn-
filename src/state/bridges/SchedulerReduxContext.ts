// src/state/bridges/SchedulerReduxContext.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 SchedulerReduxContext — Implementación Redux del SchedulerContext
// ═══════════════════════════════════════════════════════════════

import type { Store } from '@reduxjs/toolkit';
import type { RootState } from '@state/store';
import { AssetRegistry } from '@services/assets/AssetRegistry';
import { setPlayhead } from '@state/slices/transport/transportSlice';
import { audioEngine } from '@audio/engine/AudioEngine';
import type {
  SchedulerContext,
  SchedulerSnapshot,
  SchedulerClip,
  SchedulerLoopState,
} from '@audio/scheduling/SchedulerContext';

export class SchedulerReduxContext implements SchedulerContext {
  private readonly _store: Store<RootState>;

  private _cachedSnapshot: SchedulerSnapshot | null = null;
  private _cachedClipsByIdRef: RootState['clips']['byId'] | null = null;
  private _cachedTransportRef: RootState['transport'] | null = null;

  constructor(store: Store<RootState>) {
    this._store = store;
  }

  // ═══════════════════════════════════════════
  // Snapshot
  // ═══════════════════════════════════════════

  public getSnapshot(): SchedulerSnapshot {
    const state = this._store.getState();

    const clipsSame = state.clips.byId === this._cachedClipsByIdRef;
    const transportSame = state.transport === this._cachedTransportRef;

    if (clipsSame && transportSame && this._cachedSnapshot) {
      return this._cachedSnapshot;
    }

    const clips: SchedulerClip[] = [];
    for (const clipId of state.clips.allIds) {
      const clip = state.clips.byId[clipId];
      if (!clip) continue;

      clips.push({
        id: clip.id,
        trackId: clip.trackId,
        assetId: clip.assetId ?? null,
        startTime: clip.startTime,
        duration: clip.duration,
        offset: clip.offset ?? 0,
        gain: clip.gain ?? 1,
        fadeIn: clip.fadeIn ?? 0,
        fadeOut: clip.fadeOut ?? 0,
      });
    }

    const loop: SchedulerLoopState = {
      enabled: state.transport.loopEnabled,
      start: state.transport.loopStart,
      end: state.transport.loopEnd,
    };

    const snapshot: SchedulerSnapshot = { clips, loop };

    this._cachedSnapshot = snapshot;
    this._cachedClipsByIdRef = state.clips.byId;
    this._cachedTransportRef = state.transport;

    return snapshot;
  }

  // ═══════════════════════════════════════════
  // Playhead
  // ═══════════════════════════════════════════

  public onPlayheadChange(seconds: number): void {
    this._store.dispatch(setPlayhead(seconds));
  }

  // ═══════════════════════════════════════════
  // Assets
  // ═══════════════════════════════════════════

  public getAsset(assetId: string): AudioBuffer | null {
    return AssetRegistry.get(assetId) ?? null;
  }

  // ═══════════════════════════════════════════
  // Audio engine
  // state → audio está permitido por boundaries ✅
  // ═══════════════════════════════════════════

  public getAudioCurrentTime(): number {
    return audioEngine.currentTime;
  }

  public getAudioOutputTime(): number {
    return audioEngine.audioOutputTime;
  }

  public isAudioReady(): boolean {
    return audioEngine.isInitialized;
  }

  public getAudioContext(): AudioContext {
    return audioEngine.context;
  }

  public getTrackNode(trackId: string): { input: AudioNode } | null {
    return audioEngine.routingGraph.getTrack(trackId) ?? null;
  }

  // ═══════════════════════════════════════════
  // Utilidades
  // ═══════════════════════════════════════════

  public invalidateCache(): void {
    this._cachedSnapshot = null;
    this._cachedClipsByIdRef = null;
    this._cachedTransportRef = null;
  }
}