import { memo, useCallback } from 'react';
import './EffectSlot.css';

export interface EffectSlotProps {
  /** Nombre del efecto. Si es undefined/null → slot vacío */
  name?: string | null;
  /** Está en bypass */
  bypassed?: boolean;
  /** Está seleccionado/activo (mostrando UI del plugin, etc.) */
  active?: boolean;
  /** Índice en la cadena (para mostrar y para DnD) */
  index?: number;
  /** Deshabilitado */
  disabled?: boolean;
  /** Toggle de bypass */
  onToggleBypass?: () => void;
  /** Click en el slot (típicamente abrir UI del efecto) */
  onClick?: () => void;
  /** Eliminar efecto del slot */
  onRemove?: () => void;
  /** Añadir efecto (típicamente en slot vacío) */
  onAdd?: () => void;
}

/**
 * EffectSlot
 * ----------
 * Slot individual de una cadena de efectos (FX chain).
 *
 * Estados visuales:
 *   - Vacío (name = null/undefined)
 *   - Con efecto
 *   - Bypass
 *   - Activo (UI abierta)
 *
 * ✔ Memoizado
 * ✔ Handlers estables (useCallback)
 * ✔ Accesible (ARIA + teclado)
 * ✔ Semánticamente correcto (button real)
 * ✔ Sin console.log
 * ✔ Preparado para DnD (data-index)
 */
function EffectSlotBase({
  name,
  bypassed = false,
  active = false,
  index,
  disabled = false,
  onToggleBypass,
  onClick,
  onRemove,
  onAdd,
}: EffectSlotProps) {
  const isEmpty = !name;
  const displayName = isEmpty ? 'Empty' : name;

  // ═══════════════════════════════════
  // Handlers estables
  // ═══════════════════════════════════
  const handleClick = useCallback(() => {
    if (disabled) return;
    if (isEmpty) {
      onAdd?.();
    } else {
      onClick?.();
    }
  }, [disabled, isEmpty, onAdd, onClick]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!isEmpty && onRemove) {
          e.preventDefault();
          onRemove();
        }
      } else if (e.key.toLowerCase() === 'b') {
        if (!isEmpty && onToggleBypass) {
          e.preventDefault();
          onToggleBypass();
        }
      }
    },
    [disabled, handleClick, isEmpty, onRemove, onToggleBypass]
  );

  const handleBypass = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled || isEmpty) return;
      onToggleBypass?.();
    },
    [disabled, isEmpty, onToggleBypass]
  );

  const handleRemove = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (disabled) return;
      onRemove?.();
    },
    [disabled, onRemove]
  );

  // ═══════════════════════════════════
  // Clases
  // ═══════════════════════════════════
  const classes = [
    'fx-slot',
    isEmpty && 'is-empty',
    bypassed && !isEmpty && 'is-bypassed',
    active && 'is-active',
    disabled && 'is-disabled',
  ]
    .filter(Boolean)
    .join(' ');

  const bypassTitle = bypassed ? 'Activar efecto' : 'Bypass (B)';
  const slotTitle = isEmpty
    ? 'Añadir efecto'
    : `${displayName}${bypassed ? ' (bypass)' : ''} — Click para abrir`;

  return (
    <div
      className={classes}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={slotTitle}
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      data-index={index}
      title={slotTitle}
    >
      {/* Botón de bypass (solo si hay efecto) */}
      {!isEmpty && (
        <button
          type="button"
          className={`fx-slot-power ${bypassed ? 'off' : 'on'}`}
          onClick={handleBypass}
          aria-label={bypassTitle}
          aria-pressed={!bypassed}
          title={bypassTitle}
          disabled={disabled}
        >
          <span className="fx-slot-led" aria-hidden="true" />
        </button>
      )}

      {/* Nombre del efecto */}
      <span className="fx-slot-name">
        {isEmpty ? (
          <span className="fx-slot-placeholder">+ Add FX</span>
        ) : (
          displayName
        )}
      </span>

      {/* Botón de eliminar (solo si hay efecto) */}
      {!isEmpty && onRemove && (
        <button
          type="button"
          className="fx-slot-remove"
          onClick={handleRemove}
          aria-label={`Quitar ${displayName}`}
          title="Quitar efecto (Delete)"
          disabled={disabled}
        >
          ×
        </button>
      )}
    </div>
  );
}

export const EffectSlot = memo(EffectSlotBase);