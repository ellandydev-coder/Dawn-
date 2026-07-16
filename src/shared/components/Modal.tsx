// src/shared/components/Modal.tsx

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import './Modal.css';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

/**
 * Selector CSS de elementos focusables dentro del modal.
 * Usado por el focus trap para saber por dónde navegar con Tab.
 */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * Stack global de modales abiertos.
 * Sirve para que Escape solo cierre el modal superior (top-most)
 * cuando hay varios modales apilados (si el modal permite Escape).
 */
const modalStack: string[] = [];

/**
 * Contador de modales que han bloqueado el scroll del body.
 * Necesario para modales anidados: solo restauramos el scroll
 * cuando el ÚLTIMO modal se cierra (no cuando cierra cualquiera).
 */
let bodyScrollLockCount = 0;
let originalBodyOverflow: string | null = null;

/**
 * Isomorfico useLayoutEffect: usa useLayoutEffect en cliente,
 * useEffect en SSR (evita warning de "useLayoutEffect en server").
 */
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Aplica el bloqueo de scroll al body de forma segura ante
 * modales anidados (usa contador de referencia).
 */
function acquireBodyScrollLock(): void {
  if (bodyScrollLockCount === 0) {
    originalBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  bodyScrollLockCount += 1;
}

/**
 * Libera el bloqueo de scroll. Solo restaura el overflow original
 * cuando el último modal se cierra.
 */
function releaseBodyScrollLock(): void {
  bodyScrollLockCount = Math.max(0, bodyScrollLockCount - 1);
  if (bodyScrollLockCount === 0 && originalBodyOverflow !== null) {
    document.body.style.overflow = originalBodyOverflow;
    originalBodyOverflow = null;
  }
}

/**
 * Añade el modal al stack global. Idempotente: si el modalId
 * ya estaba, lo mueve al top (garantiza que solo aparece 1 vez).
 */
function pushModalStack(modalId: string): void {
  const existing = modalStack.indexOf(modalId);
  if (existing >= 0) modalStack.splice(existing, 1);
  modalStack.push(modalId);
}

/**
 * Quita el modal del stack global. Idempotente.
 */
function removeFromModalStack(modalId: string): void {
  const idx = modalStack.indexOf(modalId);
  if (idx >= 0) modalStack.splice(idx, 1);
}

/**
 * Obtiene todos los elementos focusables dentro de un contenedor,
 * excluyendo los marcados con data-focus-trap-skip.
 */
function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
  ).filter((el) => !el.hasAttribute('data-focus-trap-skip'));
}

/**
 * Sanitiza un useId() para uso seguro como id HTML.
 * React 18 genera IDs con `:` que son válidos HTML pero rompen
 * document.querySelector('#foo:bar').
 */
function sanitizeId(rawId: string): string {
  return rawId.replace(/[^a-zA-Z0-9_-]/g, '-');
}

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'auto';

export interface ModalProps {
  /** Si el modal está visible */
  isOpen: boolean;

  /** Callback al cerrar (Escape, backdrop, botón X — según flags) */
  onClose: () => void;

  /** Título mostrado en el header — también usado como aria-labelledby */
  title?: ReactNode;

  /**
   * Texto plano del título para lectores de pantalla y
   * `aria-labelledby`. Se usa si `title` es un ReactNode complejo
   * (JSX) y quieres asegurar que los AT lean algo limpio.
   * Si no se pasa y `title` es string, se usa `title`.
   */
  ariaTitle?: string;

  /** Contenido del modal */
  children: ReactNode;

  /** Contenido del footer (botones OK/Cancel/Apply, etc.) */
  footer?: ReactNode;

  /** Tamaño preset del modal @default 'md' */
  size?: ModalSize;

  /**
   * Si el click en el backdrop cierra el modal.
   * @default false  (strict close — el usuario debe usar los botones del footer)
   */
  closeOnBackdropClick?: boolean;

  /**
   * Si Escape cierra el modal.
   * @default false  (strict close — el usuario debe usar los botones del footer)
   */
  closeOnEscape?: boolean;

  /**
   * Muestra el botón X en el header.
   * @default false  (strict close — el cierre se controla desde el footer)
   */
  showCloseButton?: boolean;

  /** Clase CSS adicional para el contenedor del modal */
  className?: string;

  /** Estilo inline adicional para el contenedor */
  style?: CSSProperties;

  /**
   * ID del contenedor donde renderizar el portal.
   * Si no se pasa, usa `document.body`.
   */
  portalTargetId?: string;

  /**
   * ARIA role del modal.
   * - `'dialog'`: modal estándar (default)
   * - `'alertdialog'`: alertas críticas que requieren respuesta
   * @default 'dialog'
   */
  role?: 'dialog' | 'alertdialog';
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * Modal base reutilizable.
 *
 * Renderizado vía React Portal (escapa del stacking context).
 * Incluye focus trap, restauración de foco al cerrar, bloqueo
 * de scroll del body (con soporte para modales anidados) y
 * stack global para Escape.
 *
 * ⚠️ Por defecto es "strict close": el usuario NO puede cerrar
 * el modal con Escape, click en backdrop, ni botón X. Debe usar
 * los botones del footer (Cancel/Apply/OK). Esto evita cierres
 * accidentales que descarten cambios sin querer.
 *
 * Para modales menos estrictos (confirm dialogs, tooltips grandes),
 * habilita explícitamente `closeOnEscape` / `closeOnBackdropClick`
 * / `showCloseButton`.
 *
 * @example
 * // Modal estricto (default) — solo se cierra con los botones
 * <Modal isOpen={open} onClose={close} title="Properties"
 *   footer={<button onClick={close}>OK</button>}>
 *   ...
 * </Modal>
 *
 * @example
 * // Modal permisivo — permite todas las formas de cerrar
 * <Modal isOpen={open} onClose={close} title="Info"
 *   closeOnEscape closeOnBackdropClick showCloseButton>
 *   ...
 * </Modal>
 */
export function Modal({
  isOpen,
  onClose,
  title,
  ariaTitle,
  children,
  footer,
  size = 'md',
  closeOnBackdropClick = false,
  closeOnEscape = false,
  showCloseButton = false,
  className,
  style,
  portalTargetId,
  role = 'dialog',
}: ModalProps) {
  const rawId  = useId();
  const modalId = useMemo(() => sanitizeId(rawId), [rawId]);
  const titleId = `${modalId}-title`;

  const containerRef         = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  /**
   * Guarda el elemento donde ocurrió el `mousedown` en el
   * backdrop. Solo cerramos con backdrop click si tanto el
   * `mousedown` como el `mouseup` ocurrieron en el backdrop
   * (evita cierres accidentales al hacer click-drag desde el
   * interior del modal hacia fuera al seleccionar texto).
   */
  const backdropMouseDownTargetRef = useRef<EventTarget | null>(null);

  // ═══════════════════════════════════════════════════════════
  // 🔒 STACK DE MODALES + BODY SCROLL LOCK
  //
  // Ambos van juntos porque tienen el mismo ciclo de vida:
  // se activan al abrir, se desactivan al cerrar/desmontar.
  // ═══════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isOpen) return;

    pushModalStack(modalId);
    acquireBodyScrollLock();

    return () => {
      removeFromModalStack(modalId);
      releaseBodyScrollLock();
    };
  }, [isOpen, modalId]);

  // ═══════════════════════════════════════════════════════════
  // 🎯 FOCUS MANAGEMENT
  //
  // Usamos useLayoutEffect (isomorphic) para enfocar ANTES del
  // paint del navegador → el usuario nunca ve un flash con el
  // foco en el body debajo del modal.
  // ═══════════════════════════════════════════════════════════

  useIsomorphicLayoutEffect(() => {
    if (!isOpen) return;

    // Guarda el elemento activo antes de abrir
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement) ?? null;

    const container = containerRef.current;
    if (!container) return;

    // Si algún hijo tiene autoFocus, el navegador ya lo enfocó.
    // Solo tomamos control si el foco está fuera del modal.
    const activeIsInside = container.contains(document.activeElement);
    if (!activeIsInside) {
      // Enfocamos el container (no un input/botón concreto).
      // Beneficios:
      //   • No hay input pre-seleccionado listo para escribir
      //   • No hay botón resaltado al abrir el modal
      //   • Escape/Tab siguen funcionando desde el container
      container.focus({ preventScroll: true });
    }

    return () => {
      // Restaura foco al cerrar
      const prev = previouslyFocusedRef.current;
      previouslyFocusedRef.current = null;

      if (prev && typeof prev.focus === 'function' && document.contains(prev)) {
        // preventScroll: no queremos que la página salte al restaurar
        prev.focus({ preventScroll: true });
      }
    };
  }, [isOpen]);

  // ═══════════════════════════════════════════════════════════
  // ⌨️ KEYBOARD: Escape (opt-in) + Focus trap (Tab)
  // ═══════════════════════════════════════════════════════════

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLDivElement>) => {
      // Escape → cerrar solo si opt-in Y soy el modal superior
      if (e.key === 'Escape' && closeOnEscape) {
        const topModalId = modalStack[modalStack.length - 1];
        if (topModalId === modalId) {
          e.stopPropagation();
          onClose();
        }
        return;
      }

      // Tab → focus trap (siempre activo, no depende de closeOn*)
      if (e.key !== 'Tab') return;

      const container = containerRef.current;
      if (!container) return;

      const focusable = getFocusableElements(container);

      // Si no hay elementos focusables, atrapamos Tab en el container
      // para no perder el foco fuera del modal.
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus({ preventScroll: true });
        return;
      }

      const first  = focusable[0];
      const last   = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        // Shift+Tab en el primero (o foco fuera) → ir al último
        if (active === first || !container.contains(active)) {
          e.preventDefault();
          last.focus({ preventScroll: true });
        }
      } else {
        // Tab en el último (o foco fuera) → volver al primero
        if (active === last || !container.contains(active)) {
          e.preventDefault();
          first.focus({ preventScroll: true });
        }
      }
    },
    [closeOnEscape, modalId, onClose]
  );

  // ═══════════════════════════════════════════════════════════
  // 🖱️ BACKDROP CLICK (opt-in)
  //
  // Guard contra click-drag desde dentro del modal:
  //   - mousedown en el interior + mouseup en el backdrop
  //     NO debe cerrar (patrón común al seleccionar texto)
  //   - Solo cerramos si AMBOS eventos ocurrieron en el backdrop
  // ═══════════════════════════════════════════════════════════

  const handleBackdropMouseDown = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      backdropMouseDownTargetRef.current = e.target;
    },
    []
  );

  const handleBackdropClick = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      const downTarget = backdropMouseDownTargetRef.current;
      backdropMouseDownTargetRef.current = null;

      if (!closeOnBackdropClick) return;
      // Solo cerrar si ambos (mousedown Y click) fueron en el backdrop
      if (e.target === e.currentTarget && downTarget === e.currentTarget) {
        onClose();
      }
    },
    [closeOnBackdropClick, onClose]
  );

  // ═══════════════════════════════════════════════════════════
  // 🚫 EARLY RETURN
  // ═══════════════════════════════════════════════════════════

  if (!isOpen) return null;
  if (typeof document === 'undefined') return null; // SSR guard

  const target = portalTargetId
    ? document.getElementById(portalTargetId) ?? document.body
    : document.body;

  // ═══════════════════════════════════════════════════════════
  // 🎨 RENDER
  // ═══════════════════════════════════════════════════════════

  const containerClassName = [
    'modal-container',
    `modal-size-${size}`,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const hasHeader = Boolean(title) || showCloseButton;

  // aria-labelledby: si title es string simple, apuntamos al <h2>.
  // Si es ReactNode complejo y hay ariaTitle explícito, usamos aria-label.
  const useAriaLabelledBy = Boolean(title) && !ariaTitle;
  const useAriaLabel      = Boolean(ariaTitle);

  return createPortal(
    <div
      className="modal-backdrop"
      onMouseDown={handleBackdropMouseDown}
      onClick={handleBackdropClick}
      role="presentation"
    >
      <div
        ref={containerRef}
        className={containerClassName}
        style={style}
        role={role}
        aria-modal="true"
        aria-labelledby={useAriaLabelledBy ? titleId : undefined}
        aria-label={useAriaLabel ? ariaTitle : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {hasHeader && (
          <header className="modal-header">
            {title && (
              <h2 id={titleId} className="modal-title">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <button
                type="button"
                className="modal-close-btn"
                onClick={onClose}
                aria-label="Cerrar"
                title="Cerrar"
              >
                ×
              </button>
            )}
          </header>
        )}

        <div className="modal-body">
          {children}
        </div>

        {footer && (
          <footer className="modal-footer">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    target
  );
}