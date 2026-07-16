/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/immutability */
/* eslint-disable react-hooks/refs */
// src/shared/components/Tooltip.tsx

import {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import './Tooltip.css';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export type TooltipPlacement =
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-start'
  | 'top-end'
  | 'bottom-start'
  | 'bottom-end';

export interface CursorPosition {
  x: number;
  y: number;
}

export interface TooltipProps {
  content: ReactNode;
  children: ReactElement;
  placement?: TooltipPlacement;
  showDelay?: number;
  hideDelay?: number;
  offset?: number;
  disabled?: boolean;
  open?: boolean;
  className?: string;
  role?: 'tooltip' | 'status';
  followCursor?: boolean;
  cursorPosition?: CursorPosition | null;
  anchorPct?: number;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES
// ═══════════════════════════════════════════════════════════════

const DEFAULT_SHOW_DELAY = 300;
const DEFAULT_HIDE_DELAY = 0;
const DEFAULT_OFFSET = 8;
const VIEWPORT_MARGIN = 8;

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS
// ═══════════════════════════════════════════════════════════════

interface Position {
  top: number;
  left: number;
}

function computePositionFromRect(
  targetRect: DOMRect,
  tooltipRect: DOMRect,
  placement: TooltipPlacement,
  offset: number,
  anchorPct?: number
): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;

  const useAnchor =
    typeof anchorPct === 'number' &&
    (placement === 'left' || placement === 'right');

  switch (placement) {
    case 'top':
      top  = targetRect.top - tooltipRect.height - offset;
      left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
      break;
    case 'top-start':
      top  = targetRect.top - tooltipRect.height - offset;
      left = targetRect.left;
      break;
    case 'top-end':
      top  = targetRect.top - tooltipRect.height - offset;
      left = targetRect.right - tooltipRect.width;
      break;
    case 'bottom':
      top  = targetRect.bottom + offset;
      left = targetRect.left + (targetRect.width - tooltipRect.width) / 2;
      break;
    case 'bottom-start':
      top  = targetRect.bottom + offset;
      left = targetRect.left;
      break;
    case 'bottom-end':
      top  = targetRect.bottom + offset;
      left = targetRect.right - tooltipRect.width;
      break;
    case 'left':
      top = useAnchor
        ? targetRect.top + (targetRect.height * (anchorPct! / 100)) - tooltipRect.height / 2
        : targetRect.top + (targetRect.height - tooltipRect.height) / 2;
      left = targetRect.left - tooltipRect.width - offset;
      break;
    case 'right':
      top = useAnchor
        ? targetRect.top + (targetRect.height * (anchorPct! / 100)) - tooltipRect.height / 2
        : targetRect.top + (targetRect.height - tooltipRect.height) / 2;
      left = targetRect.right + offset;
      break;
  }

  return clampToViewport(top, left, tooltipRect, vw, vh);
}

function computePositionFromCursor(
  cursor: CursorPosition,
  tooltipRect: DOMRect,
  placement: TooltipPlacement,
  offset: number
): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top = 0;
  let left = 0;

  switch (placement) {
    case 'right':
    case 'top-end':
    case 'bottom-end':
      top  = cursor.y - tooltipRect.height / 2;
      left = cursor.x + offset;
      break;
    case 'left':
    case 'top-start':
    case 'bottom-start':
      top  = cursor.y - tooltipRect.height / 2;
      left = cursor.x - tooltipRect.width - offset;
      break;
    case 'top':
      top  = cursor.y - tooltipRect.height - offset;
      left = cursor.x - tooltipRect.width / 2;
      break;
    case 'bottom':
      top  = cursor.y + offset;
      left = cursor.x - tooltipRect.width / 2;
      break;
  }

  return clampToViewport(top, left, tooltipRect, vw, vh);
}

function clampToViewport(
  top: number,
  left: number,
  tooltipRect: DOMRect,
  vw: number,
  vh: number
): Position {
  left = Math.max(VIEWPORT_MARGIN,
    Math.min(left, vw - tooltipRect.width - VIEWPORT_MARGIN));
  top = Math.max(VIEWPORT_MARGIN,
    Math.min(top, vh - tooltipRect.height - VIEWPORT_MARGIN));
  return { top, left };
}

// ═══════════════════════════════════════════════════════════════
// 🔑 COMPONENTE
// ═══════════════════════════════════════════════════════════════

export function Tooltip({
  content,
  children,
  placement       = 'top',
  showDelay       = DEFAULT_SHOW_DELAY,
  hideDelay       = DEFAULT_HIDE_DELAY,
  offset          = DEFAULT_OFFSET,
  disabled        = false,
  open,
  className,
  role            = 'tooltip',
  followCursor    = false,
  cursorPosition  = null,
  anchorPct,
}: TooltipProps) {
  const isControlled = open !== undefined;

  const [isVisible, setIsVisible] = useState(false);
  const [position,  setPosition]  = useState<Position | null>(null);

  const targetRef    = useRef<HTMLElement | null>(null);
  const tooltipRef   = useRef<HTMLDivElement | null>(null);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  // Actualizamos lastCursorRef en useEffect, no en render
  const lastCursorRef = useRef<CursorPosition | null>(null);
  useEffect(() => {
    if (cursorPosition) {
      lastCursorRef.current = cursorPosition;
    }
  }, [cursorPosition]);

  const shouldShow = isControlled ? Boolean(open) : isVisible;

  const clearTimers = useCallback(() => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const handleShow = useCallback(() => {
    if (disabled || isControlled) return;
    clearTimers();
    if (showDelay <= 0) {
      setIsVisible(true);
    } else {
      showTimerRef.current = window.setTimeout(() => {
        setIsVisible(true);
        showTimerRef.current = null;
      }, showDelay);
    }
  }, [disabled, isControlled, showDelay, clearTimers]);

  const handleHide = useCallback(() => {
    if (isControlled) return;
    clearTimers();
    if (hideDelay <= 0) {
      setIsVisible(false);
    } else {
      hideTimerRef.current = window.setTimeout(() => {
        setIsVisible(false);
        hideTimerRef.current = null;
      }, hideDelay);
    }
  }, [isControlled, hideDelay, clearTimers]);

  useEffect(() => {
    if (!shouldShow) {
      lastCursorRef.current = null;
    }
  }, [shouldShow]);

  useEffect(() => {
    return clearTimers;
  }, [clearTimers]);

  // ─── Layout effect: posicionar tooltip ───────────────────
  useLayoutEffect(() => {
    if (!shouldShow) {
      setPosition(null);
      return;
    }

    const target  = targetRef.current;
    const tooltip = tooltipRef.current;
    if (!tooltip) return;

    const update = () => {
      const tooltipRect = tooltip.getBoundingClientRect();

      if (followCursor) {
        const cursor = cursorPosition ?? lastCursorRef.current;
        if (!cursor) return;
        setPosition(
          computePositionFromCursor(cursor, tooltipRect, placement, offset)
        );
      } else {
        if (!target) return;
        const targetRect = target.getBoundingClientRect();
        setPosition(
          computePositionFromRect(targetRect, tooltipRect, placement, offset, anchorPct)
        );
      }
    };

    update();

    if (followCursor) return;

    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);

    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [shouldShow, placement, offset, content, followCursor, cursorPosition, anchorPct]);

  if (!isValidElement(children)) {
    if (import.meta.env.DEV) {
      console.warn('[Tooltip] children debe ser un único ReactElement válido');
    }
    return children;
  }

  const childProps = children.props as {
    ref?: Ref<HTMLElement>;
    onMouseEnter?: (e: ReactMouseEvent<HTMLElement>) => void;
    onMouseLeave?: (e: ReactMouseEvent<HTMLElement>) => void;
    onFocus?: (e: React.FocusEvent<HTMLElement>) => void;
    onBlur?: (e: React.FocusEvent<HTMLElement>) => void;
  };

  const clonedChild = cloneElement(children, {
    ref: (node: HTMLElement | null) => {
      targetRef.current = node;
      const originalRef = childProps.ref;
      if (typeof originalRef === 'function') {
        originalRef(node);
      } else if (originalRef && typeof originalRef === 'object') {
        (originalRef as React.MutableRefObject<HTMLElement | null>).current = node;
      }
    },
    onMouseEnter: (e: ReactMouseEvent<HTMLElement>) => {
      childProps.onMouseEnter?.(e);
      handleShow();
    },
    onMouseLeave: (e: ReactMouseEvent<HTMLElement>) => {
      childProps.onMouseLeave?.(e);
      handleHide();
    },
    onFocus: (e: React.FocusEvent<HTMLElement>) => {
      childProps.onFocus?.(e);
      handleShow();
    },
    onBlur: (e: React.FocusEvent<HTMLElement>) => {
      childProps.onBlur?.(e);
      handleHide();
    },
  } as Partial<React.HTMLAttributes<HTMLElement>>);

  const tooltipStyle: CSSProperties = position
    ? { top: position.top, left: position.left, visibility: 'visible' }
    : { top: -9999, left: -9999, visibility: 'hidden' };

  const tooltipClassName = ['tooltip', className].filter(Boolean).join(' ');

  return (
    <>
      {clonedChild}
      {shouldShow &&
        createPortal(
          <div
            ref={tooltipRef}
            className={tooltipClassName}
            style={tooltipStyle}
            role={role}
            data-placement={placement}
          >
            {content}
          </div>,
          document.body
        )}
    </>
  );
}