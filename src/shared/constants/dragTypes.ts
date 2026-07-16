/**
 * Tipos MIME custom para el sistema de drag & drop de la DAW.
 * Usar constantes evita typos y facilita refactoring.
 */
export const DRAG_TYPES = {
  ASSET: 'application/x-webdaw-asset',
  CLIP: 'application/x-webdaw-clip',
} as const;