// src/features/clip-properties/types.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 Tipos del feature clip-properties
// ═══════════════════════════════════════════════════════════════

/**
 * Estado editable local del modal.
 * Se inicializa desde el clip y se aplica al store solo con OK/Apply.
 */
export interface EditableState {
  name: string;
  startTime: number; // segundos
  duration: number;  // segundos
  offset: number;    // segundos
  gain: number;      // lineal (0..2)
  fadeIn: number;    // segundos
  fadeOut: number;   // segundos
}

export interface ClipPropertiesModalProps {
  /** ID del clip a editar. Si es null, el modal está cerrado. */
  clipId: string | null;
  /** Callback al cerrar (Cancel u OK después de aplicar). */
  onClose: () => void;
}

// Debe coincidir con MIN_CLIP_DURATION del slice (fuente de verdad).
// TODO(consistency): mover a un módulo compartido de clip constants
// para evitar drift silencioso entre UI y slice.
export const MIN_DURATION = 0.001;
export const MIN_TIME_VALUE = 0;
export const FADE_CURVE_LINEAR = 0;