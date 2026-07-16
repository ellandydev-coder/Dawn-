// src/shared/hooks/useDraggableWindow.ts

import { useRef, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface DraggableWindowOptions {
  /** Posición inicial (px desde top-left de la ventana) */
  initialX?: number;
  initialY?: number;
  /** Si true, la ventana no puede salir de los límites del viewport */
  clampToViewport?: boolean;
}

export interface DraggableWindowResult {
  /** Ref para el contenedor de la ventana (position: fixed) */
  windowRef: React.RefObject<HTMLDivElement>;
  /** Ref para el área de drag handle (el header) */
  handleRef: React.RefObject<HTMLDivElement>;
}

// ═══════════════════════════════════════════════════════════════
// 🪝 HOOK
// ═══════════════════════════════════════════════════════════════

/**
 * useDraggableWindow
 * ------------------
 * Hook genérico para ventanas flotantes arrastrables.
 *
 * Uso:
 * ```tsx
 * const { windowRef, handleRef } = useDraggableWindow({ initialX: 200, initialY: 150 });
 *
 * return (
 *   <div ref={windowRef} style={{ position: 'fixed', width: 500 }}>
 *     <div ref={handleRef}>← arrastrar aquí</div>
 *     <div>contenido</div>
 *   </div>
 * );
 * ```
 *
 * ⚠️ El contenedor DEBE tener `position: fixed` o `position: absolute`.
 * El hook mueve el elemento via `style.left` / `style.top` directamente
 * (sin pasar por React state → sin re-renders durante el drag).
 *
 * Internamente usa refs para los handlers en lugar de useCallback
 * encadenado, evitando la referencia circular onMouseUp → onMouseUp.
 */
export function useDraggableWindow({
  initialX = 200,
  initialY = 150,
  clampToViewport = true,
}: DraggableWindowOptions = {}): DraggableWindowResult {
  const windowRef = useRef<HTMLDivElement>(null!);
  const handleRef = useRef<HTMLDivElement>(null!);

  // Guardamos clampToViewport en ref para que los handlers
  // siempre lean el valor actual sin necesitar re-crearse
  const clampRef = useRef(clampToViewport);
  useEffect(() => { clampRef.current = clampToViewport; }, [clampToViewport]);

  // Offset entre el punto de click y la esquina top-left de la ventana
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // ─── Setup: posición inicial + listeners ──────────────────

  useEffect(() => {
    const win = windowRef.current;
    const handle = handleRef.current;
    if (!win || !handle) return;

    // Aplicar posición inicial via DOM (sin state → sin re-render)
    win.style.left = `${initialX}px`;
    win.style.top  = `${initialY}px`;

    // ── Handlers definidos dentro del effect para evitar
    //    referencias circulares entre useCallbacks ──────────

    const handleMouseMove = (e: MouseEvent) => {
      let newX = e.clientX - dragOffsetRef.current.x;
      let newY = e.clientY - dragOffsetRef.current.y;

      if (clampRef.current) {
        const rect = win.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        // Al menos 40px del header siempre visibles
        newX = Math.max(-(rect.width - 40), Math.min(vw - 40, newX));
        newY = Math.max(0, Math.min(vh - 40, newY));
      }

      win.style.left = `${newX}px`;
      win.style.top  = `${newY}px`;
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup',   handleMouseUp);
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Solo drag con botón izquierdo
      if (e.button !== 0) return;

      const rect = win.getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup',   handleMouseUp);

      // Evitar selección de texto durante el drag
      e.preventDefault();
    };

    handle.addEventListener('mousedown', handleMouseDown);

    return () => {
      handle.removeEventListener('mousedown', handleMouseDown);
      // Limpieza defensiva si el componente se desmonta mid-drag
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup',   handleMouseUp);
    };
    // initialX / initialY solo se aplican al montar (posición inicial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { windowRef, handleRef };
}