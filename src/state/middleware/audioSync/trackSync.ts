// src/state/middleware/audioSync/trackSync.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 Sincronización de propiedades de track → audio graph
// ═══════════════════════════════════════════════════════════════

import { audioEngine } from '@audio/engine/AudioEngine';
import type { RootState } from '@state/store';
import { isAudioReady } from './helpers';
import { applyMuteSoloLogic } from './muteSync';
import { applyChannelRouting } from './channelRouting';

/**
 * Sincroniza una track del state → grafo de audio.
 * Puede crear el nodo si aún no existe (createIfMissing).
 */
export function syncTrackNodeFromState(
  trackId: string,
  state: RootState,
  createIfMissing = false
): void {
  if (!isAudioReady()) return;

  const track = state.tracks.byId[trackId];
  if (!track) return;

  const routingGraph = audioEngine.routingGraph;
  const node =
    routingGraph.getTrack(trackId) ??
    (createIfMissing ? routingGraph.createTrack(trackId) : null);

  if (!node) return;

  node.setVolume(track.volume);
  node.setPan(track.pan);
  applyMuteSoloLogic(trackId, state);

  // Routing según mixer channel
  const channel = state.mixer.channels[trackId];
  if (channel?.outputBusId) {
    applyChannelRouting(trackId, channel.outputBusId);
  }
}

/**
 * Elimina el nodo de audio de una track del grafo.
 */
export function removeTrackNode(trackId: string): void {
  if (!isAudioReady()) return;
  audioEngine.routingGraph.removeTrack(trackId);
}