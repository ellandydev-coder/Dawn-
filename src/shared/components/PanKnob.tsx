import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import './PanKnob.css';

// ═══════════════════════════════════════════
// Types
// ═══════════════════════════════════════════
interface PanKnobProps {
  value: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  onDoubleClick?: () => void;
  size?: number;
  disabled?: boolean;
  label?: string;
  showLR?: boolean;
  valueText?: string;
  ariaValueText?: string;
  ariaValueMin?: number;
  ariaValueMax?: number;
  ariaValueNow?: number;
}

// ═══════════════════════════════════════════
// Constantes
// ═══════════════════════════════════════════
const MAX_ANGLE = 135;
const CENTER_THRESHOLD = 0.02;
const DEFAULT_SENSITIVITY = 0.005;
const FINE_SENSITIVITY = 0.001;
const WHEEL_STEP = 0.05;
const WHEEL_STEP_FINE = 0.01;
const KEYBOARD_STEP = 0.05;
const KEYBOARD_STEP_FINE = 0.01;
const KEYBOARD_STEP_LARGE = 0.1;
const KNOB_PADDING = 12;
const TRACK_ARC_D = 'M 20.3 79.7 A 42 42 0 1 1 79.7 79.7';

// ═══════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════
const clampPan = (v: number): number => Math.max(-1, Math.min(1, v));
const valueToAngle = (v: number): number => v * MAX_ANGLE;
const isCenter = (v: number): boolean => Math.abs(v) < CENTER_THRESHOLD;

const buildArcPath = (value: number): string => {
  const angleDeg = value * MAX_ANGLE;
  const angleRad = (angleDeg * Math.PI) / 180;
  const cx = 50;
  const cy = 50;
  const r = 42;

  const startX = cx;
  const startY = cy - r;
  const endX = cx + Math.sin(angleRad) * r;
  const endY = cy - Math.cos(angleRad) * r;

  const sweep = value > 0 ? 1 : 0;
  const largeArc = Math.abs(angleDeg) > 180 ? 1 : 0;

  return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} ${sweep} ${endX} ${endY}`;
};

const formatPanDisplay = (v: number): string => {
  if (isCenter(v)) return 'C';
  const pct = Math.round(Math.abs(v) * 100);
  return v < 0 ? `L${pct}` : `R${pct}`;
};

const tryRequestPointerLock = (
  el: HTMLElement,
  onAcquired: () => void,
  onFailed: () => void
): boolean => {
  if (!('requestPointerLock' in el)) return false;

  try {
    const result = el.requestPointerLock();
    if (result && typeof (result as Promise<void>).then === 'function') {
      (result as Promise<void>).then(onAcquired).catch(onFailed);
    } else {
      onAcquired();
    }
    return true;
  } catch {
    onFailed();
    return false;
  }
};

const exitPointerLockSafe = (): void => {
  if (document.pointerLockElement) {
    try {
      document.exitPointerLock();
    } catch {
      /* browser puede denegar */
    }
  }
};

// ═══════════════════════════════════════════
// Component
// ═══════════════════════════════════════════

function PanKnobBase({
  value,
  onChange,
  onCommit,
  onDoubleClick,
  size = 36,
  disabled = false,
  label,
  showLR = false,
  valueText,
  ariaValueText,
  ariaValueMin,
  ariaValueMax,
  ariaValueNow,
}: PanKnobProps) {
  const knobRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasPointerLock, setHasPointerLock] = useState(false);

  // ── Refs actualizadas en useEffect (no en render)
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  const onCommitRef = useRef(onCommit);

  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { onCommitRef.current = onCommit; }, [onCommit]);

  // ── Derived values memoizados
  const safeValue = clampPan(value);
  const angle = valueToAngle(safeValue);

  const defaultDisplayValue = useMemo(
    () => formatPanDisplay(safeValue),
    [safeValue]
  );

  const resolvedDisplayValue = valueText ?? defaultDisplayValue;
  const resolvedAriaValueText = ariaValueText ?? resolvedDisplayValue;
  const resolvedAriaValueMin = ariaValueMin ?? -1;
  const resolvedAriaValueMax = ariaValueMax ?? 1;
  const resolvedAriaValueNow =
    ariaValueNow ?? Math.round(safeValue * 100) / 100;

  const arcD = useMemo(
    () => (isCenter(safeValue) ? '' : buildArcPath(safeValue)),
    [safeValue]
  );
  const showArc = !isCenter(safeValue);
  const arcColor = safeValue < 0 ? '#7a8cff' : '#22c55e';

  const totalSize = size + KNOB_PADDING;

  // ═══════════════════════════════════
  // Pointer Down → inicia drag
  // ═══════════════════════════════════
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();

      const knob = knobRef.current;
      if (!knob) return;

      const lockRequested = tryRequestPointerLock(
        knob,
        () => setHasPointerLock(true),
        () => setHasPointerLock(false)
      );

      setHasPointerLock(lockRequested);
      setIsDragging(true);
    },
    [disabled]
  );

  // ═══════════════════════════════════
  // Drag global
  // ═══════════════════════════════════
  useEffect(() => {
    if (!isDragging) return;

    let lastY = 0;
    let fallbackStarted = false;

    const handleMove = (e: MouseEvent) => {
      let dy: number;

      if (hasPointerLock && document.pointerLockElement === knobRef.current) {
        dy = -e.movementY;
      } else {
        if (!fallbackStarted) {
          lastY = e.clientY;
          fallbackStarted = true;
          return;
        }
        dy = -(e.clientY - lastY);
        lastY = e.clientY;
      }

      const sensitivity = e.shiftKey ? FINE_SENSITIVITY : DEFAULT_SENSITIVITY;
      const newValue = clampPan(valueRef.current + dy * sensitivity);

      valueRef.current = newValue;
      onChangeRef.current(newValue);
    };

    const finishDrag = () => {
      exitPointerLockSafe();
      setIsDragging(false);
      setHasPointerLock(false);
      onCommitRef.current?.(valueRef.current);
    };

    const handleLockChange = () => {
      if (!document.pointerLockElement) {
        setHasPointerLock(false);
      }
    };

    const handleBlur = () => finishDrag();

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', finishDrag);
    document.addEventListener('pointerlockchange', handleLockChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', finishDrag);
      document.removeEventListener('pointerlockchange', handleLockChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isDragging, hasPointerLock]);

  // ═══════════════════════════════════
  // Wheel
  // ═══════════════════════════════════
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      if (disabled) return;
      e.preventDefault();

      const step = e.shiftKey ? WHEEL_STEP_FINE : WHEEL_STEP;
      const direction = e.deltaY > 0 ? -1 : 1;
      const newValue = clampPan(valueRef.current + step * direction);

      onChange(newValue);
      onCommit?.(newValue);
    },
    [disabled, onChange, onCommit]
  );

  // ═══════════════════════════════════
  // Keyboard
  // ═══════════════════════════════════
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      const step = e.shiftKey ? KEYBOARD_STEP_FINE : KEYBOARD_STEP;
      let newValue: number;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowUp':
          newValue = clampPan(valueRef.current + step);
          break;
        case 'ArrowLeft':
        case 'ArrowDown':
          newValue = clampPan(valueRef.current - step);
          break;
        case 'Home':
          newValue = -1;
          break;
        case 'End':
          newValue = 1;
          break;
        case 'PageUp':
          newValue = clampPan(valueRef.current + KEYBOARD_STEP_LARGE);
          break;
        case 'PageDown':
          newValue = clampPan(valueRef.current - KEYBOARD_STEP_LARGE);
          break;
        default:
          return;
      }

      e.preventDefault();
      onChange(newValue);
      onCommit?.(newValue);
    },
    [disabled, onChange, onCommit]
  );

  // ═══════════════════════════════════
  // Cleanup pointer lock al desmontar
  // ═══════════════════════════════════
  useEffect(() => {
    const knob = knobRef.current;
    return () => {
      if (document.pointerLockElement === knob) {
        exitPointerLockSafe();
      }
    };
  }, []);

  // ═══════════════════════════════════
  // Estilos memoizados
  // ═══════════════════════════════════
  const containerStyle = useMemo(
    () => ({ width: totalSize, height: totalSize }),
    [totalSize]
  );

  const bodyStyle = useMemo(
    () => ({
      width: size,
      height: size,
      transform: `translate(-50%, -50%) rotate(${angle}deg)`,
    }),
    [size, angle]
  );

  const knobClassName = useMemo(() => {
    const parts = ['panknob'];
    if (isDragging) parts.push('is-dragging');
    if (disabled) parts.push('is-disabled');
    return parts.join(' ');
  }, [isDragging, disabled]);

  return (
    <div className="panknob-container">
      <div
        ref={knobRef}
        className={knobClassName}
        style={containerStyle}
        onPointerDown={handlePointerDown}
        onDoubleClick={disabled ? undefined : onDoubleClick}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        tabIndex={disabled ? -1 : 0}
        role="slider"
        aria-label={label ?? 'Pan'}
        aria-valuemin={resolvedAriaValueMin}
        aria-valuemax={resolvedAriaValueMax}
        aria-valuenow={resolvedAriaValueNow}
        aria-valuetext={resolvedAriaValueText}
        aria-orientation="horizontal"
        aria-disabled={disabled || undefined}
      >
        <svg
          className="panknob-arc"
          viewBox="0 0 100 100"
          width={totalSize}
          height={totalSize}
          aria-hidden="true"
        >
          <path
            d={TRACK_ARC_D}
            fill="none"
            stroke="#2a2a35"
            strokeWidth="3"
            strokeLinecap="round"
          />
          {showArc && (
            <path
              d={arcD}
              fill="none"
              stroke={arcColor}
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          )}
        </svg>

        <div className="panknob-body" style={bodyStyle}>
          <div className="panknob-indicator" />
        </div>
      </div>

      {showLR ? (
        <div className="panknob-lr mono" aria-hidden="true">
          <span className={safeValue < -CENTER_THRESHOLD ? 'active-l' : ''}>
            L
          </span>
          <span className={safeValue > CENTER_THRESHOLD ? 'active-r' : ''}>
            R
          </span>
        </div>
      ) : (
        <div className="panknob-label mono" aria-hidden="true">
          {resolvedDisplayValue}
        </div>
      )}
    </div>
  );
}

export const PanKnob = memo(PanKnobBase);