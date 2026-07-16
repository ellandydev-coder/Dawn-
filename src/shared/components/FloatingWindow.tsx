// src/shared/components/FloatingWindow.tsx

import {
  memo,
  useCallback,
  useState,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import { useDraggableWindow } from '@shared/hooks/useDraggableWindow';
import { PushpinIcon } from '@shared/components/icons/ui/PushpinIcon';

import './FloatingWindow.css';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface FloatingWindowProps {
  /** Texto del título (izquierda del titlebar) */
  title: string;

  /** Contenido de la ventana (todo lo que va debajo del titlebar) */
  children: ReactNode;

  /** Handler al pulsar el botón × o cerrar externamente */
  onClose: () => void;

  /** Posición inicial (px). Default: 200 / 120 */
  initialX?: number;
  initialY?: number;

  /**
   * Ancho de la ventana en px o CSS válido (ej. "80vw").
   * Default: 560px
   */
  width?: number | string;

  /**
   * Alto mínimo en px. Default: 320
   * El alto real depende del contenido; se acota con maxHeight="80vh".
   */
  minHeight?: number;

  /** Alto máximo. Default: "80vh" */
  maxHeight?: number | string;

  /** Clase CSS extra para el contenedor raíz */
  className?: string;

  /**
   * ARIA label. Si no se pasa, se usa `title`.
   * Útil cuando el título visible es distinto del label accesible.
   */
  ariaLabel?: string;

  /** Atributos data-* opcionales para debugging/testing */
  dataAttrs?: Record<string, string>;

  /**
   * Callback opcional al togglear el pin (anchored).
   * Si no se pasa, el estado del pin es puramente local.
   */
  onAnchoredChange?: (anchored: boolean) => void;

  /** Estado inicial del pin. Default: false */
  initialAnchored?: boolean;

  /**
   * Si true, oculta el botón del pin (solo se ve el ×).
   * Útil para ventanas donde el "anchored" no aplica.
   */
  hideAnchorButton?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * FloatingWindow
 * --------------
 * Ventana flotante reutilizable (non-modal) estilo REAPER.
 *
 * Provee gratis:
 *   • Renderizado via createPortal en document.body (escapa overflow)
 *   • Drag desde el titlebar (useDraggableWindow)
 *   • Pin/anchor (📌) con animación (aguja + altura)
 *   • Botón × para cerrar
 *   • Estilos consistentes con el resto de ventanas flotantes
 *   • Accesibilidad (role=dialog, aria-label, aria-pressed)
 *
 * Uso:
 * ```tsx
 * <FloatingWindow title="FX: Kick" onClose={handleClose} width={560}>
 *   <MyContent />
 * </FloatingWindow>
 * ```
 *
 * Para varias ventanas del mismo tipo, escalonarlas con initialX/Y:
 * ```tsx
 * <FloatingWindow
 *   title={`FX: ${name}`}
 *   initialX={200 + index * 30}
 *   initialY={120 + index * 30}
 *   onClose={handleClose}
 * >
 * ```
 */
function FloatingWindowBase({
  title,
  children,
  onClose,
  initialX = 200,
  initialY = 120,
  width = 560,
  minHeight = 320,
  maxHeight = '80vh',
  className,
  ariaLabel,
  dataAttrs,
  onAnchoredChange,
  initialAnchored = false,
  hideAnchorButton = false,
}: FloatingWindowProps) {
  // ─── Draggable ──────────────────────────────────────────────

  const { windowRef, handleRef } = useDraggableWindow({
    initialX,
    initialY,
    clampToViewport: true,
  });

  // ─── Estado del pin (anchored) ──────────────────────────────

  const [isAnchored, setIsAnchored] = useState(initialAnchored);

  const handleToggleAnchored = useCallback(() => {
    setIsAnchored((prev) => {
      const next = !prev;
      onAnchoredChange?.(next);
      return next;
    });
  }, [onAnchoredChange]);

  // ─── Fix drag vs click en botones del titlebar ──────────────

  /**
   * Evita que mousedown en los botones del titlebar burbujee al
   * drag handler (useDraggableWindow), que llama preventDefault()
   * y bloquearía que el evento click se disparara.
   */
  const stopTitlebarMouseDown = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
  }, []);

  // ─── Estilo dinámico del contenedor ─────────────────────────

  const rootStyle: CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    minHeight: `${minHeight}px`,
    maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight,
  };

  const rootClassName = [
    'floating-window',
    isAnchored && 'is-anchored',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // ─── Render via Portal ──────────────────────────────────────

  return createPortal(
    <div
      ref={windowRef}
      className={rootClassName}
      style={rootStyle}
      role="dialog"
      aria-label={ariaLabel ?? title}
      {...dataAttrs}
    >
      {/* ── Title bar (drag handle) ────────────────────────── */}
      <div ref={handleRef} className="floating-window__titlebar">
        <span className="floating-window__title">{title}</span>

        <div className="floating-window__titlebar-actions">
          {!hideAnchorButton && (
            <button
              type="button"
              className={`floating-window__btn-anchor ${isAnchored ? 'is-active' : ''}`}
              onClick={handleToggleAnchored}
              onMouseDown={stopTitlebarMouseDown}
              title={isAnchored ? 'Unanchor window' : 'Anchor window'}
              aria-label={isAnchored ? 'Unanchor window' : 'Anchor window'}
              aria-pressed={isAnchored}
            >
              <PushpinIcon size={14} pinned={isAnchored} />
            </button>
          )}

          <button
            type="button"
            className="floating-window__btn-close"
            onClick={onClose}
            onMouseDown={stopTitlebarMouseDown}
            title="Close"
            aria-label="Close window"
          >
            ×
          </button>
        </div>
      </div>

      {/* ── Body: contenido del usuario ────────────────────── */}
      <div className="floating-window__body">{children}</div>
    </div>,
    document.body
  );
}

export const FloatingWindow = memo(FloatingWindowBase);