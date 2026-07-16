// src/features/clip-properties/components/TimeInput.tsx
// ═══════════════════════════════════════════════════════════════
// 🎛️ TimeInput — Input controlado con buffer local para tiempos
// ═══════════════════════════════════════════════════════════════

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';

import { formatTime, parseTime } from '../utils/formatters';
import { MIN_TIME_VALUE } from '../types';

interface TimeInputProps {
  id?: string;
  value: number; // segundos
  onCommit: (seconds: number) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}

function TimeInputBase({
  id,
  value,
  onCommit,
  className,
  placeholder = '0:00.000',
  ariaLabel,
}: TimeInputProps) {
  const [buffer, setBuffer] = useState<string>(() => formatTime(value));
  const isFocusedRef = useRef(false);
  const lastSyncedValueRef = useRef<number>(value);

  useEffect(() => {
    if (isFocusedRef.current) return;
    if (value === lastSyncedValueRef.current) return;
    lastSyncedValueRef.current = value;
    setBuffer(formatTime(value));
  }, [value]);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setBuffer(e.target.value);
  }, []);

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
  }, []);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    const parsed = parseTime(buffer);

    if (parsed === null || parsed < MIN_TIME_VALUE) {
      setBuffer(formatTime(value));
      return;
    }

    const normalized = Math.max(MIN_TIME_VALUE, parsed);
    setBuffer(formatTime(normalized));
    lastSyncedValueRef.current = normalized;

    if (normalized !== value) {
      onCommit(normalized);
    }
  }, [buffer, value, onCommit]);

  const handleKeyDown = useCallback(
    (e: ReactKeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.currentTarget.blur();
        return;
      }
      if (e.key === 'Escape') {
        e.stopPropagation();
        setBuffer(formatTime(value));
        e.currentTarget.blur();
      }
    },
    [value]
  );

  return (
    <input
      id={id}
      type="text"
      className={className}
      value={buffer}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      inputMode="decimal"
      spellCheck={false}
      autoComplete="off"
      aria-label={ariaLabel}
    />
  );
}

export const TimeInput = memo(TimeInputBase);