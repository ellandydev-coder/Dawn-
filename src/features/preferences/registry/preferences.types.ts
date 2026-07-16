// src/features/preferences/registry/preferences.types.ts

import type { ComponentType } from 'react';
import type { RegistryEntry } from '@shared/registry/registry.types';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/**
 * Props que recibe el componente de un panel de Preferences.
 *
 * `panelId` permite al componente identificarse a sí mismo
 * (útil para dispatch de patchPanel, telemetría, etc.).
 */
export interface PreferencePanelComponentProps {
  /** ID único del panel (el mismo que en registration.id) */
  panelId: string;
}

/**
 * Componente React de un panel de Preferences.
 * Acepta las props estándar y devuelve JSX.
 */
export type PreferencePanelComponent =
  ComponentType<PreferencePanelComponentProps>;

/**
 * Factory de defaults del panel.
 *
 * Devuelve el objeto plano con los valores iniciales de las
 * settings del panel. Se ejecuta UNA vez en el bootstrap para
 * inicializar el subárbol del slice `preferences.byPanelId[id]`.
 *
 * Ejemplo:
 *   defaults: () => ({ scanOnStartup: true, useGenericUi: false })
 */
export type PreferencePanelDefaults = () => Record<string, unknown>;

/**
 * Entry de un panel en el registry de Preferences.
 *
 * Extiende RegistryEntry (aporta `id`) con los metadatos y el
 * componente del panel. El registry es auto-descubierto via
 * Vite glob eager desde `src/features/preferences/panels/[dir]/index.ts`.
 *
 * === CAMPOS OBLIGATORIOS ===
 * • id       → identificador único ("plugins.vst", "audio.device")
 * • label    → etiqueta visible en el sidebar
 *
 * === CAMPOS OPCIONALES ===
 * • parentId    → si es sub-categoría, id del padre
 * • description → tooltip + subtítulo del panel
 * • order       → posición dentro de su grupo (menor = arriba)
 * • component   → si NO se provee, la categoría es agrupadora
 *                 (solo aparece en el sidebar, sin panel al clicar)
 * • defaults    → factory de estado inicial del panel.
 *                 Solo relevante si el panel tiene estado editable.
 *                 Si se omite, el panel es "read-only" (no toca el store).
 */
export interface PreferencePanelEntry extends RegistryEntry {
  /** Etiqueta visible en el sidebar */
  readonly label: string;

  /** ID del panel padre (para sub-categorías). Undefined = raíz. */
  readonly parentId?: string;

  /** Descripción corta (tooltip + subtítulo) */
  readonly description?: string;

  /**
   * Orden dentro del grupo (raíz o hijos de un padre).
   * Menor número = aparece antes. Si no se provee, se ordena
   * por orden de descubrimiento (path alfabético del glob).
   */
  readonly order?: number;

  /**
   * Componente React del panel. Opcional:
   *   - Si se provee → al clicar la categoría se muestra el panel
   *   - Si NO se provee → la categoría es un simple "grupo" en el sidebar
   *     y al clicarla el content muestra un placeholder auto-generado.
   */
  readonly component?: PreferencePanelComponent;

  /**
   * Factory de defaults del panel. Se ejecuta 1 vez en el bootstrap.
   * Solo necesario si el panel tiene estado editable en el store.
   */
  readonly defaults?: PreferencePanelDefaults;
}

// ═══════════════════════════════════════════════════════════════
// 🎯 SHAPE DEL STATE (para el slice genérico)
// ═══════════════════════════════════════════════════════════════

/**
 * Shape genérico del slice `preferences` en Redux.
 *
 * `byPanelId` es un mapa dinámico: cada panel registrado con
 * `defaults` reserva su key aquí al bootstrap.
 *
 * El tipo concreto de cada valor se conoce solo desde el panel
 * que lo definió (via su selector tipado). Desde fuera se ve
 * como `unknown` — obligando a usar selectores tipados.
 *
 * Esta indirección es el precio de la extensibilidad total:
 * a cambio, añadir un panel nuevo NO requiere tocar este slice.
 */
export interface PreferencesStateShape {
  readonly byPanelId: Record<string, unknown>;
}