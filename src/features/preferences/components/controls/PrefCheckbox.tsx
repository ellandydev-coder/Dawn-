// src/features/preferences/components/controls/PrefCheckbox.tsx

import { memo, useCallback, useId } from 'react';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface PrefCheckboxProps {
  /** Texto visible al lado del checkbox */
  label: string;
  /** Estado actual (controlado) */
  checked: boolean;
  /** Callback al cambiar el estado */
  onChange: (checked: boolean) => void;
  /** Si true, el checkbox se ve deshabilitado y no responde */
  disabled?: boolean;
  /** Descripción opcional que aparece debajo del label (más pequeña, gris) */
  hint?: string;
  /**
   * Título HTML nativo (tooltip). Si no se pasa, se usa `label`.
   */
  title?: string;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * PrefCheckbox
 * ------------
 * Checkbox estándar para paneles de Preferences.
 *
 * Uso:
 * ```tsx
 * <PrefCheckbox
 *   label="Scan new/updated plug-ins on startup"
 *   checked={scanOnStartup}
 *   onChange={(v) => dispatch(patchVst({ scanOnStartup: v }))}
 * />
 * ```
 *
 * Diseño:
 *   • Checkbox nativo con estilos custom (☑ / ☐)
 *   • Label clicable (toggle al hacer click en el texto también)
 *   • Hint opcional debajo (estilo help text)
 */
function PrefCheckboxBase({
  label,
  checked,
  onChange,
  disabled = false,
  hint,
  title,
}: PrefCheckboxProps) {
  const id = useId();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.checked);
    },
    [onChange]
  );

  return (
    <div
      className={`pref-checkbox ${disabled ? 'is-disabled' : ''}`}
      title={title ?? label}
    >
      <input
        id={id}
        type="checkbox"
        className="pref-checkbox__input"
        checked={checked}
        onChange={handleChange}
        disabled={disabled}
      />
      <label htmlFor={id} className="pref-checkbox__label">
        {label}
      </label>
      {hint && <div className="pref-checkbox__hint">{hint}</div>}
    </div>
  );
}

export const PrefCheckbox = memo(PrefCheckboxBase);