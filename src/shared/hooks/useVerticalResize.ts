// src/shared/hooks/useVerticalResize.ts

import { useCallback, useEffect, useRef, useState } from 'react';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface UseVerticalResizeOptions {
  /** Valor actual (px). Se lee al empezar el drag. */
  initialSize: number;
  /** Callback cuando el usuario suelta el mouse (commit). Recibe el valor final. */
  onCommit: (finalSize: number) => void;
  /**
   * Callback opcional durante el drag (por cada mousemove).
   * Útil para feedback visual en tiempo real sin commit.
   */
  onChange?: (currentSize: number) => void;
  /** Tamaño mínimo permitido (px). Default: 0 */
  minSize?: number;
  /** Tamaño máximo permitido (px). Default: Infinity */
  maxSize?: number;
  /** Invertir dirección: si true, arrastrar hacia abajo REDUCE el tamaño. Default: false */
  invert?: boolean;
}

export interface UseVerticalResizeResult {
  /** Handler que debes pasar al onMouseDown del elemento handle. */
  onMouseDown: (e: React.MouseEvent) => void;
  /** True mientras el usuario está arrastrando. Útil para clases CSS. */
  isDragging: boolean;
  /** Tamaño actual durante el drag (solo válido si isDragging === true). */
  currentSize: number | null;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const DEFAULT_MIN_SIZE = 0;
const DEFAULT_MAX_SIZE = Infinity;

// ═══════════════════════════════════════════════════════════════
// 🎯 HOOK
// ═══════════════════════════════════════════════════════════════

/**
 * useVerticalResize
 * -----------------
 * Hook genérico para redimensionar verticalmente cualquier elemento
 * arrastrando un handle con el mouse.
 *
 * Reutilizable en: tracks, mixer channels, sidebars, paneles.
 *
 * @example
 * const { onMouseDown, isDragging } = useVerticalResize({
 *   initialSize: track.height,
 *   onCommit: (h) => dispatch(setTrackHeight({ id: trackId, height: h })),
 *   minSize: 48,
 *   maxSize: 320,
 * });
 *
 * return (
 *   <div
 *     className={`resize-handle ${isDragging ? 'is-dragging' : ''}`}
 *     onMouseDown={onMouseDown}
 *   />
 * );
 */
export function useVerticalResize(
  options: UseVerticalResizeOptions
): UseVerticalResizeResult {
  const {
    initialSize,
    onCommit,
    onChange,
    minSize = DEFAULT_MIN_SIZE,
    maxSize = DEFAULT_MAX_SIZE,
    invert = false,
  } = options;

  const [isDragging, setIsDragging] = useState(false);
  const [currentSize, setCurrentSize] = useState<number | null>(null);

  // Refs para no depender de closures obsoletos en los listeners globales
  const dragStartYRef = useRef<number>(0);
  const dragStartSizeRef = useRef<number>(0);
  const lastSizeRef = useRef<number>(initialSize);

  // Refs de callbacks/opciones (evitan re-attach de listeners al cambiar props)
  const onCommitRef = useRef(onCommit);
  const onChangeRef = useRef(onChange);
  const minSizeRef = useRef(minSize);
  const maxSizeRef = useRef(maxSize);
  const invertRef = useRef(invert);

  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { minSizeRef.current = minSize; }, [minSize]);
  useEffect(() => { maxSizeRef.current = maxSize; }, [maxSize]);
  useEffect(() => { invertRef.current = invert; }, [invert]);

  // ─── mousedown en el handle ───────────────────────────────
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Solo botón izquierdo
      if (e.button !== 0) return;

      e.preventDefault();
      e.stopPropagation();

      dragStartYRef.current = e.clientY;
      dragStartSizeRef.current = initialSize;
      lastSizeRef.current = initialSize;

      setIsDragging(true);
      setCurrentSize(initialSize);
    },
    [initialSize]
  );

  // ─── mousemove + mouseup globales mientras se arrastra ────
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - dragStartYRef.current;
      const adjustedDelta = invertRef.current ? -deltaY : deltaY;
      const nextSize = clamp(
        dragStartSizeRef.current + adjustedDelta,
        minSizeRef.current,
        maxSizeRef.current
      );

      lastSizeRef.current = nextSize;
      setCurrentSize(nextSize);
      onChangeRef.current?.(nextSize);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setCurrentSize(null);
      onCommitRef.current(lastSizeRef.current);
    };

    // Cursor global durante el drag
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'ns-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isDragging]);

  return {
    onMouseDown,
    isDragging,
    currentSize,
  };
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}