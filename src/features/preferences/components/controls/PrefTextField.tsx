// src/features/preferences/components/controls/PrefTextField.tsx

import { memo, useCallback, useId } from 'react';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface PrefTextFieldProps {
  /** Label opcional arriba del input */
  label?: string;
  /** Valor actual */
  value: string;
  /** Callback al cambiar el texto (dispara en cada tecla) */
  onChange: (value: string) => void;
  /** Placeholder cuando el input está vacío */
  placeholder?: string;
  /** Si true, se ve deshabilitado */
  disabled?: boolean;
  /** Descripción opcional debajo del input */
  hint?: string;
  /**
   * Si true, el texto se muestra en fuente monoespaciada.
   * Útil para paths, URLs, IDs.
   */
  monospace?: boolean;
  /** Callback opcional al pulsar Enter */
  onEnter?: () => void;
  /** ARIA label si el label visible no es suficiente */
  ariaLabel?: string;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * PrefTextField
 * -------------
 * Input de texto de una sola línea para paneles de Preferences.
 *
 * Uso:
 * ```tsx
 * <PrefTextField
 *   label="VST plug-in paths (separated by ;):"
 *   value={pluginPaths}
 *   onChange={(v) => dispatch(patchVst({ pluginPaths: v }))}
 *   monospace
 *   placeholder="C:\\Program Files\\VstPlugins;C:\\Common\\VST3"
 * />
 * ```
 *
 * Para paths largos, usa `monospace` para mejor legibilidad.
 */
function PrefTextFieldBase({
  label,
  value,
  onChange,
  placeholder,
  disabled = false,
  hint,
  monospace = false,
  onEnter,
  ariaLabel,
}: PrefTextFieldProps) {
  const id = useId();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && onEnter) {
        e.preventDefault();
        onEnter();
      }
    },
    [onEnter]
  );

  const inputClassName = [
    'pref-textfield__input',
    monospace && 'is-mono',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`pref-textfield ${disabled ? 'is-disabled' : ''}`}
    >
      {label && (
        <label htmlFor={id} className="pref-textfield__label">
          {label}
        </label>
      )}
      <input
        id={id}
        type="text"
        className={inputClassName}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        aria-label={ariaLabel ?? label}
        spellCheck={false}
        autoComplete="off"
      />
      {hint && <div className="pref-textfield__hint">{hint}</div>}
    </div>
  );
}

export const PrefTextField = memo(PrefTextFieldBase);