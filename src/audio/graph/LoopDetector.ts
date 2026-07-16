// src/audio/graph/LoopDetector.ts

/**
 * LoopDetector
 * ------------
 * Funciones puras para detectar ciclos en el grafo de routing.
 *
 * Un "loop" se define recorriendo el mapa `busRouting` (busId → targetId)
 * desde un nodo inicial hasta encontrar el sink (master) o revisitar un
 * nodo (ciclo cerrado).
 *
 * NO conoce la estructura interna de RoutingGraph — recibe todos los
 * datos necesarios por parámetro. Esto las hace triviales de testear.
 */

/**
 * ¿Desde `startId` se llega a `avoidId` siguiendo `busRouting`?
 *
 * Usado para validar `routeBus(busId, targetId)`:
 *   avoidId  = busId       (el que se está rerouteando)
 *   startId  = targetId    (el nuevo destino)
 *
 * @param avoidId    ID que NO debe aparecer en la cadena aguas abajo
 * @param startId    ID desde el cual empezar el recorrido
 * @param masterId   ID del master bus (sink terminal, nunca crea loop)
 * @param busRouting Map de busId → targetId
 * @returns true si se encuentra un loop
 */
export function wouldBusRoutingCreateLoop(
  avoidId: string,
  startId: string,
  masterId: string,
  busRouting: ReadonlyMap<string, string>
): boolean {
  // Master es sink terminal: nunca crea loop
  if (startId === masterId) return false;

  const visited = new Set<string>();
  let current: string | undefined = startId;

  while (current && !visited.has(current)) {
    if (current === avoidId) return true;
    visited.add(current);
    current = busRouting.get(current);
  }

  return false;
}

/**
 * ¿Un send desde `sourceId` hacia `destinationId` crearía loop?
 *
 * Loop = destino ruta de vuelta al source siguiendo `busRouting`.
 * Los tracks no rutean recursivamente, así que solo hay que chequear
 * la cadena de buses aguas abajo del destination.
 *
 * @returns true si:
 *   - source === destination (loop obvio), o
 *   - la cadena de routing desde destination llega de vuelta a source
 */
export function wouldSendCreateLoop(
  sourceId: string,
  destinationId: string,
  masterId: string,
  busRouting: ReadonlyMap<string, string>
): boolean {
  // Loop obvio
  if (sourceId === destinationId) return true;

  // Master es sink terminal: sends al master nunca crean loop
  if (destinationId === masterId) return false;

  const visited = new Set<string>();
  let current: string | undefined = destinationId;

  while (current && !visited.has(current)) {
    if (current === sourceId) return true;
    visited.add(current);
    current = busRouting.get(current);
  }

  return false;
}