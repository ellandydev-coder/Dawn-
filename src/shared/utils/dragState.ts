/**
 * dragState.ts
 * ------------
 * Singleton de estado de drag para la DAW.
 *
 * Problema que resuelve:
 * ----------------------
 * La HTML5 Drag & Drop API no permite leer dataTransfer.getData()
 * fuera del evento dragstart (restricción de seguridad del spec).
 * Los listeners en dragover/drop reciben dataTransfer.types pero
 * getData() devuelve "" — por eso useAssetDragDrop no podía leer
 * el assetId desde el evento.
 *
 * Solución:
 * ---------
 * El drag source (AssetItem / Sidebar) escribe el id aquí en el
 * momento exacto del dragstart, antes de que ningún otro evento
 * se dispare. El drop target (useAssetDragDrop) lo lee de aquí,
 * no de dataTransfer.
 *
 * Por qué un módulo y no un Context/Ref:
 * ---------------------------------------
 * - No necesita re-renders (es estado de drag, no de UI)
 * - Se accede desde hooks y listeners nativos por igual
 * - Sin timing issues: escritura y lectura son síncronas
 * - Sin dependencias de React
 */

// ─── Estado interno ────────────────────────────────────────────
let _currentAssetId: string | null = null;

// ─── API pública ───────────────────────────────────────────────

/**
 * Registra el asset que está siendo arrastrado.
 * Llamar en el handler onDragStart del componente fuente.
 */
export function setDraggedAssetId(id: string): void {
  _currentAssetId = id;
}

/**
 * Retorna el assetId actualmente en drag, o null si no hay drag.
 */
export function getDraggedAssetId(): string | null {
  return _currentAssetId;
}

/**
 * Limpia el estado. Llamar en dragend o después de procesar el drop.
 */
export function clearDraggedAssetId(): void {
  _currentAssetId = null;
}

// TEMP DEBUG
if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).__dragState = { getDraggedAssetId };
}