// src/features/preferences/panels/_seed/roots.ts

import type { PreferencePanelEntry } from '@features/preferences/registry';

// ═══════════════════════════════════════════════════════════════
// 🌱 SEED — CATEGORÍAS RAÍZ (agrupadoras + placeholders)
// ═══════════════════════════════════════════════════════════════

/*
 * ─── PROPÓSITO ────────────────────────────────────────────────
 * Este archivo registra TEMPORALMENTE todas las categorías raíz
 * del árbol de Preferences (estilo REAPER), MIENTRAS no tengan
 * panel real implementado.
 *
 * A medida que se implementen paneles reales para categorías raíz
 * "no agrupadoras" (ej. Item Loop Defaults, Control/OSC/web,
 * External Editors), eliminamos su entry de este seed y creamos
 * su propia carpeta:
 *
 *   panels/item-loop-defaults/
 *     ├── index.ts             ← registration con component
 *     ├── ItemLoopDefaultsPanel.tsx
 *     └── ItemLoopDefaultsPanel.css
 *
 * ─── CATEGORÍAS AGRUPADORAS ───────────────────────────────────
 * Algunas raíces son PURAMENTE agrupadoras (Audio, Appearance,
 * Editing Behavior, Media, Plug-ins). No tendrán nunca panel
 * propio — solo agrupan hijos en el sidebar. Se quedan aquí
 * permanentemente sin `component`.
 *
 * ─── ORDEN ────────────────────────────────────────────────────
 * El campo `order` define la posición vertical en el sidebar.
 * Multiplicamos por 10 (10, 20, 30...) para dejar espacio a
 * inserciones futuras sin renumerar todo.
 */

export const registration: PreferencePanelEntry[] = [
  // ── Item Loop Defaults (raíz suelta, sin hijos) ───────────
  {
    id: 'item-loop-defaults',
    label: 'Item Loop Defaults',
    description: 'Defaults de looping para nuevos items',
    order: 10,
    // component: undefined → placeholder auto-generado
  },

  // ── Audio (agrupadora, sin panel propio) ──────────────────
  {
    id: 'audio',
    label: 'Audio',
    description: 'Configuración del motor de audio',
    order: 20,
  },

  // ── Appearance (agrupadora) ───────────────────────────────
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Colores, tema y densidad de la UI',
    order: 30,
  },

  // ── Editing Behavior (agrupadora) ─────────────────────────
  {
    id: 'editing',
    label: 'Editing Behavior',
    description: 'Comportamiento de edición y navegación',
    order: 40,
  },

  // ── Media (agrupadora) ────────────────────────────────────
  {
    id: 'media',
    label: 'Media',
    description: 'Importación y manejo de archivos multimedia',
    order: 50,
  },

  // ── Plug-ins (agrupadora) ─────────────────────────────────
  {
    id: 'plugins',
    label: 'Plug-ins',
    description: 'Gestión y comportamiento de plugins',
    order: 60,
  },

  // ── Control/OSC/web (raíz suelta) ─────────────────────────
  {
    id: 'control-osc-web',
    label: 'Control/OSC/web',
    description: 'Superficies de control, OSC y control web',
    order: 70,
  },

  // ── External Editors (raíz suelta) ────────────────────────
  {
    id: 'external-editors',
    label: 'External Editors',
    description: 'Editores externos para archivos de audio',
    order: 80,
  },
];