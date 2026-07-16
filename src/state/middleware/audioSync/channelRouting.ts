// src/state/middleware/audioSync/channelRouting.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 Routing de canales → audio graph
// ═══════════════════════════════════════════════════════════════

import { audioEngine } from '@audio/engine/AudioEngine';
import { isAudioReady } from './helpers';
import { log } from './config';

/**
 * Aplica el routing de un canal al RoutingGraph.
 * Si el bus destino no existe aún, loguea warning y no crashea.
 */
export function applyChannelRouting(
  trackId: string,
  targetBusId: string
): void {
  if (!isAudioReady()) return;

  const routingGraph = audioEngine.routingGraph;

  if (!routingGraph.hasBus(targetBusId)) {
    log(
      `Channel routing: target "${targetBusId}" no existe en el grafo. ` +
      `Track "${trackId}" queda en su ruteo previo.`,
      'warn'
    );
    return;
  }

  routingGraph.routeTrack(trackId, targetBusId);
}