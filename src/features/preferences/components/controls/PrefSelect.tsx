// src/features/preferences/components/controls/PrefSelect.tsx

import { memo, useCallback, useId } from 'react';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface PrefSelectOption<V extends string> {
  /** Valor interno (el que se guarda en el store) */
  value: V;
  /** Etiqueta visible en el dropdown */
  label: string;
}

export interface PrefSelectProps<V extends string> {
  /** Texto visible antes del select (a la izquierda). Opcional. */
  label?: string;
  /** Valor actual seleccionado */
  value: V;
  /** Lista de opciones */
  options: readonly PrefSelectOption<V>[];
  /** Callback al cambiar la selección */
  onChange: (value: V) => void;
  /** Si true, el select se ve deshabilitado */
  disabled?: boolean;
  /** Descripción opcional debajo (help text) */
  hint?: string;
  /**
   * Layout del label:
   *   'inline' (default) → label + select en la misma línea
   *   'stacked'          → label arriba, select debajo
   */
  layout?: 'inline' | 'stacked';
  /** Ancho fijo opcional del select (px o cualquier valor CSS) */
  width?: number | string;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * PrefSelect
 * ----------
 * Dropdown/select genérico para paneles de Preferences.
 *
 * Uso:
 * ```tsx
 * <PrefSelect
 *   label="Knob mode:"
 *   value={knobMode}
 *   options={[
 *     { value: 'default', label: 'Default' },
 *     { value: 'linear',  label: 'Linear' },
 *   ]}
 *   onChange={(v) => dispatch(patchVst({ knobMode: v }))}
 * />
 * ```
 *
 * Genérico en el tipo del valor (V) para type-safety end-to-end.
 * Si tu enum tiene 4 valores, el select solo aceptará esos 4.
 */
function PrefSelectBase<V extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  hint,
  layout = 'inline',
  width,
}: PrefSelectProps<V>) {
  const id = useId();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onChange(e.target.value as V);
    },
    [onChange]
  );

  const selectStyle: React.CSSProperties | undefined =
    width !== undefined
      ? { width: typeof width === 'number' ? `${width}px` : width }
      : undefined;

  return (
    <div
      className={`pref-select pref-select--${layout} ${disabled ? 'is-disabled' : ''}`}
    >
      {label && (
        <label htmlFor={id} className="pref-select__label">
          {label}
        </label>
      )}
      <select
        id={id}
        className="pref-select__input"
        value={value}
        onChange={handleChange}
        disabled={disabled}
        style={selectStyle}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && <div className="pref-select__hint">{hint}</div>}
    </div>
  );
}

/*
 * memo() no acepta genéricos directamente en la firma inferida,
 * así que hacemos el cast explícito para preservar el tipo genérico
 * al exportar. Es un patrón estándar en TS + React.
 */
export const PrefSelect = memo(PrefSelectBase) as typeof PrefSelectBase;