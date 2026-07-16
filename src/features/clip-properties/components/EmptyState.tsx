// src/features/clip-properties/components/EmptyState.tsx
// ═══════════════════════════════════════════════════════════════
// 🎛️ EmptyState — Vista cuando no hay clip seleccionado
// ═══════════════════════════════════════════════════════════════

import { memo } from 'react';

function EmptyStateBase() {
  return (
    <div className="clip-props-no-selection" role="status">
      <div className="clip-props-no-selection-icon" aria-hidden="true">
        ♪
      </div>
      <div className="clip-props-no-selection-title">
        Sin clip seleccionado
      </div>
      <div className="clip-props-no-selection-hint">
        Selecciona un clip en la timeline para ver y editar sus propiedades.
        <br />
        Pulsa <kbd>Cancel</kbd> para cerrar esta ventana.
      </div>
    </div>
  );
}

export const EmptyState = memo(EmptyStateBase);