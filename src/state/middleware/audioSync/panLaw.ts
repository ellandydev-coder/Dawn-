// src/state/middleware/audioSync/panLaw.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 Propagación de PanLaw al audio graph
// --------------------------------------------------------------
// Propaga una PanLaw validada a todos los nodos del grafo que
// la soporten (master, buses, sends con pan habilitado).
// Uso: setPanLaw listener + loadProject listener.
// ═══════════════════════════════════════════════════════════════

import { audioEngine } from '@audio/engine/AudioEngine';
import type { PanLaw } from '@domain/enums/PanLaw';
import { isAudioReady } from './helpers';

export function propagatePanLawToGraph(panLaw: PanLaw): void {
  if (!isAudioReady()) return;

  const routingGraph = audioEngine.routingGraph;

  // Master bus
  routingGraph.masterBus.setPanLaw(panLaw);

  // Todos los buses regulares
  for (const busId of routingGraph.getAllBusIds()) {
    routingGraph.getBus(busId)?.setPanLaw(panLaw);
  }

  // Todos los sends (los que tengan pan habilitado)
  for (const sendId of routingGraph.getAllSendIds()) {
    const send = routingGraph.getSend(sendId);
    if (send?.hasPan()) {
      send.setPanLaw(panLaw);
    }
  }

  // TODO: TrackAudioNode aún no soporta setPanLaw().
  // Cuando se añada, propagar aquí también.
}