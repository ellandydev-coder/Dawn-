// src/features/preferences/components/PreferencesContent.tsx

import { memo, useMemo } from 'react';
import { findCategoryById } from '../data/preferencesCatalog';
import { PlaceholderPanel } from './panels/PlaceholderPanel';
import { VstPanel } from './panels/VstPanel';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

export interface PreferencesContentProps {
  /** ID de la categoría actualmente seleccionada */
  selectedId: string;
}

// ═══════════════════════════════════════════════════════════════
// 🏗️ COMPONENTE
// ═══════════════════════════════════════════════════════════════

/**
 * PreferencesContent
 * ------------------
 * Panel derecho de Preferences: router que decide qué componente
 * de panel renderizar según la categoría seleccionada.
 *
 * Contrato de extensión:
 *   Cuando implementes un panel real (ej. AudioDevicePanel):
 *     1. Importa el componente arriba
 *     2. Añade un `case` en el switch de `renderPanel()`
 *     3. Marca `placeholder: false` (o elimina la propiedad) en
 *        preferencesCatalog.ts para esa entrada
 *
 * El `PlaceholderPanel` sigue siendo el fallback para categorías
 * sin implementar.
 */
function PreferencesContentBase({ selectedId }: PreferencesContentProps) {
  const category = useMemo(
    () => findCategoryById(selectedId),
    [selectedId]
  );

  // ─── Categoría no encontrada (edge case) ────────────────────

  if (!category) {
    return (
      <div className="prefs-content prefs-content--empty">
        <div className="prefs-empty">
          <span className="prefs-empty__icon">❌</span>
          <div className="prefs-empty__text">
            Categoría no encontrada
            <code className="prefs-empty__id">{selectedId}</code>
          </div>
        </div>
      </div>
    );
  }

  // ─── Router de paneles ──────────────────────────────────────

  const renderPanel = () => {
    switch (category.id) {
      case 'plugins.vst':
        return <VstPanel category={category} />;

      // Futuros paneles reales van aquí:
      // case 'audio.device':      return <AudioDevicePanel category={category} />;
      // case 'appearance.theme':  return <ThemePanel category={category} />;
      // ...

      default:
        return <PlaceholderPanel category={category} />;
    }
  };

  return <div className="prefs-content">{renderPanel()}</div>;
}

export const PreferencesContent = memo(PreferencesContentBase);