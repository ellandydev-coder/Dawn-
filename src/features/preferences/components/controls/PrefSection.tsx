// src/features/preferences/components/controls/PrefSection.tsx

import { memo, type ReactNode } from 'react';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface PrefSectionProps {
  /** Título de la sección (ej. "VST compatibility") */
  title: string;
  /** Descripción opcional debajo del título */
  description?: string;
  /** Contenido de la sección (checkboxes, selects, etc.) */
  children: ReactNode;
  /**
   * Si true, la sección se ve "collapsable" con un chevron.
   * TODO: implementar collapse cuando haga falta. Por ahora solo visual.
   */
  collapsible?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * PrefSection
 * -----------
 * Sección agrupadora para paneles de Preferences.
 *
 * Renderiza un título en negrita con una línea divisoria debajo,
 * y agrupa el contenido con un padding vertical consistente.
 *
 * Uso:
 * ```tsx
 * <PrefSection title="VST compatibility">
 *   <PrefCheckbox label="..." checked={...} onChange={...} />
 *   <PrefCheckbox label="..." checked={...} onChange={...} />
 * </PrefSection>
 * ```
 *
 * Reglas de diseño:
 *   • El primer PrefSection de un panel NO necesita separador
 *     (el header del panel ya lo aporta)
 *   • Múltiples secciones apiladas quedan separadas visualmente
 *     por su propio borde superior
 */
function PrefSectionBase({
  title,
  description,
  children,
  collapsible = false,
}: PrefSectionProps) {
  return (
    <section className="pref-section">
      <header className="pref-section__header">
        <h3 className="pref-section__title">
          {collapsible && (
            <span className="pref-section__chevron" aria-hidden="true">
              ▾
            </span>
          )}
          {title}
        </h3>
        {description && (
          <p className="pref-section__desc">{description}</p>
        )}
      </header>
      <div className="pref-section__body">{children}</div>
    </section>
  );
}

export const PrefSection = memo(PrefSectionBase);