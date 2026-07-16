// src/state/middleware/audioSync/muteSync.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 Lógica mute/solo REAPER-style
// ═══════════════════════════════════════════════════════════════

import { audioEngine } from '@audio/engine/AudioEngine';
import type { RootState } from '@state/store';
import { isAudioReady } from './helpers';

function hasAnySoloedTracks(state: RootState): boolean {
  return state.tracks.allIds.some(
    (id) => state.tracks.byId[id]?.soloed === true
  );
}

/**
 * Aplica mute/solo REAPER-style a una track específica.
 * - Si HAY soloed → solo suenan las soloed y no muted
 * - Si NO hay soloed → comportamiento normal (mute directo)
 */
export function applyMuteSoloLogic(
  trackId: string,
  state: RootState
): void {
  if (!isAudioReady()) return;

  const track = state.tracks.byId[trackId];
  if (!track) return;

  const node = audioEngine.routingGraph.getTrack(trackId);
  if (!node) return;

  const anySoloed = hasAnySoloedTracks(state);
  const shouldMute = anySoloed
    ? !track.soloed || track.muted
    : track.muted;

  node.setMuted(shouldMute);
}

/**
 * Aplica mute/solo REAPER-style a TODAS las tracks.
 * Usado cuando cambia el estado de solo de cualquier track.
 */
export function applyMuteSoloLogicToAllTracks(state: RootState): void {
  if (!isAudioReady()) return;

  const anySoloed = hasAnySoloedTracks(state);
  const routingGraph = audioEngine.routingGraph;

  for (const trackId of state.tracks.allIds) {
    const track = state.tracks.byId[trackId];
    if (!track) continue;

    const node = routingGraph.getTrack(trackId);
    if (!node) continue;

    const shouldMute = anySoloed
      ? !track.soloed || track.muted
      : track.muted;

    node.setMuted(shouldMute);
  }
}