// src/features/mixer/hooks/useFaderDrag.ts
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  linearToFaderPct,
  faderPctToLinear,
} from '@shared/utils/dBConversion';

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════
const WHEEL_STEP = 1.5;
const WHEEL_STEP_FINE = 0.4;
const KEYBOARD_STEP = 2;
const KEYBOARD_STEP_FINE = 0.5;
const KEYBOARD_STEP_LARGE = 10;
const FINE_MODE_RATIO = 0.25;

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════
interface UseFaderDragOptions {
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  disabled?: boolean;
  enableWheel?: boolean;
  enableKeyboard?: boolean;
}

interface UseFaderDragReturn {
  targetRef: React.RefObject<HTMLDivElement | null>;
  isDragging: boolean;
  handlers: {
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
    onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
    onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  };
  faderPct: number;
}

export function useFaderDrag({
  value,
  onChange,
  onCommit,
  disabled = false,
  enableWheel = true,
  enableKeyboard = true,
}: UseFaderDragOptions): UseFaderDragReturn {
  const targetRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // ─── Refs de value / callbacks ───────────────────────────
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);

  // Actualizamos las refs en cada render con useEffect
  // para respetar las reglas de hooks
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);

  // ─── Refs del drag activo ─────────────────────────────────
  const activePointerIdRef = useRef<number | null>(null);
  const trackTopRef = useRef(0);
  const trackHeightRef = useRef(0);
  const grabOffsetRef = useRef(0);
  const fineAnchorRef = useRef<{ y: number; pct: number } | null>(null);
  const wasFineRef = useRef(false);

  // ─── Refs para las funciones — rompe dependencias circulares
  const handlePointerMoveRef = useRef<(e: PointerEvent) => void>(() => {});
  const handlePointerUpRef = useRef<(e: PointerEvent) => void>(() => {});
  const handleBlurRef = useRef<() => void>(() => {});

  // ═══════════════════════════════════
  // Emit + Commit
  // ═══════════════════════════════════
  const emit = useCallback((newValue: number) => {
    const clamped = Math.max(0, Math.min(1, newValue));
    valueRef.current = clamped;
    onChangeRef.current(clamped);
  }, []);

  const commit = useCallback(() => {
    onCommitRef.current?.(valueRef.current);
  }, []);

  // ═══════════════════════════════════
  // Cleanup — usa refs, sin dependencias circulares
  // ═══════════════════════════════════
  const cleanupDrag = useCallback(() => {
    document.removeEventListener('pointermove', handlePointerMoveRef.current);
    document.removeEventListener('pointerup', handlePointerUpRef.current);
    document.removeEventListener('pointercancel', handlePointerUpRef.current);
    window.removeEventListener('blur', handleBlurRef.current);

    const el = targetRef.current;
    const activeId = activePointerIdRef.current;
    if (el && activeId !== null && el.hasPointerCapture(activeId)) {
      try { el.releasePointerCapture(activeId); } catch { /* ignore */ }
    }

    activePointerIdRef.current = null;
    grabOffsetRef.current = 0;
    fineAnchorRef.current = null;
    wasFineRef.current = false;
  }, []);

  // ═══════════════════════════════════
  // Pointer Move
  // ═══════════════════════════════════
  useEffect(() => {
    handlePointerMoveRef.current = (e: PointerEvent) => {
      if (e.pointerId !== activePointerIdRef.current) return;

      const trackTop = trackTopRef.current;
      const trackHeight = trackHeightRef.current;
      if (trackHeight <= 0) return;

      const isFine = e.shiftKey;
      const currentY = e.clientY;

      if (isFine !== wasFineRef.current) {
        if (isFine) {
          fineAnchorRef.current = {
            y: currentY,
            pct: linearToFaderPct(valueRef.current),
          };
        } else {
          const currentPct = linearToFaderPct(valueRef.current);
          const thumbY = trackTop + (currentPct / 100) * trackHeight;
          grabOffsetRef.current = currentY - thumbY;
          fineAnchorRef.current = null;
        }
        wasFineRef.current = isFine;
        return;
      }

      let newPct: number;

      if (isFine && fineAnchorRef.current) {
        const dy = currentY - fineAnchorRef.current.y;
        const deltaPct = (dy / trackHeight) * 100 * FINE_MODE_RATIO;
        newPct = fineAnchorRef.current.pct + deltaPct;
      } else {
        const targetThumbY = currentY - grabOffsetRef.current;
        const yFromTop = targetThumbY - trackTop;
        newPct = (yFromTop / trackHeight) * 100;
      }

      emit(faderPctToLinear(newPct));
    };
  }, [emit]);

  // ═══════════════════════════════════
  // Pointer Up
  // ═══════════════════════════════════
  useEffect(() => {
    handlePointerUpRef.current = (e: PointerEvent) => {
      if (e.pointerId !== activePointerIdRef.current) return;
      cleanupDrag();
      setIsDragging(false);
      commit();
    };
  }, [cleanupDrag, commit]);

  // ═══════════════════════════════════
  // Blur
  // ═══════════════════════════════════
  useEffect(() => {
    handleBlurRef.current = () => {
      if (activePointerIdRef.current === null) return;
      cleanupDrag();
      setIsDragging(false);
      commit();
    };
  }, [cleanupDrag, commit]);

  // ═══════════════════════════════════
  // Pointer Down
  // ═══════════════════════════════════
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;

      const el = targetRef.current;
      if (!el) return;

      e.preventDefault();
      e.stopPropagation();

      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }

      const rect = el.getBoundingClientRect();
      trackTopRef.current = rect.top;
      trackHeightRef.current = rect.height;

      const currentPct = linearToFaderPct(valueRef.current);
      const thumbY = rect.top + (currentPct / 100) * rect.height;
      grabOffsetRef.current = e.clientY - thumbY;

      const startsFine = e.shiftKey;
      wasFineRef.current = startsFine;
      fineAnchorRef.current = startsFine
        ? { y: e.clientY, pct: currentPct }
        : null;

      activePointerIdRef.current = e.pointerId;

      // Usamos las refs para registrar los listeners
      document.addEventListener('pointermove', handlePointerMoveRef.current);
      document.addEventListener('pointerup', handlePointerUpRef.current);
      document.addEventListener('pointercancel', handlePointerUpRef.current);
      window.addEventListener('blur', handleBlurRef.current);

      setIsDragging(true);
    },
    [disabled]
  );

  // ═══════════════════════════════════
  // Cleanup al desmontar
  // ═══════════════════════════════════
  useEffect(() => {
    return () => { cleanupDrag(); };
  }, [cleanupDrag]);

  // ═══════════════════════════════════
  // Wheel
  // ═══════════════════════════════════
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      if (disabled || !enableWheel) return;
      e.preventDefault();

      const currentPct = linearToFaderPct(valueRef.current);
      const step = e.shiftKey ? WHEEL_STEP_FINE : WHEEL_STEP;
      const direction = e.deltaY > 0 ? 1 : -1;
      const newPct = currentPct - step * direction;

      emit(faderPctToLinear(newPct));
      commit();
    },
    [disabled, enableWheel, emit, commit]
  );

  // ═══════════════════════════════════
  // Keyboard
  // ═══════════════════════════════════
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (disabled || !enableKeyboard) return;

      const currentPct = linearToFaderPct(valueRef.current);
      const step = e.shiftKey ? KEYBOARD_STEP_FINE : KEYBOARD_STEP;
      let newPct = currentPct;

      switch (e.key) {
        case 'ArrowUp':   newPct = currentPct - step; break;
        case 'ArrowDown': newPct = currentPct + step; break;
        case 'PageUp':    newPct = currentPct - KEYBOARD_STEP_LARGE; break;
        case 'PageDown':  newPct = currentPct + KEYBOARD_STEP_LARGE; break;
        case 'Home':      newPct = 0; break;
        case 'End':       newPct = 100; break;
        default: return;
      }

      e.preventDefault();
      emit(faderPctToLinear(newPct));
      commit();
    },
    [disabled, enableKeyboard, emit, commit]
  );

  // ═══════════════════════════════════
  // Return
  // ═══════════════════════════════════
  const rawPct = linearToFaderPct(value);
  const faderPct = Number.isFinite(rawPct)
    ? Math.max(0, Math.min(100, rawPct))
    : 0;

  return {
    targetRef,
    isDragging,
    handlers: {
      onPointerDown: handlePointerDown,
      onWheel: handleWheel,
      onKeyDown: handleKeyDown,
    },
    faderPct,
  };
}