// src/features/preferences/data/preferencesCatalog.ts

import type {
  PreferenceCategory,
  PreferenceCategoryNode,
} from '@domain/models/PreferenceCategory';

// ═══════════════════════════════════════════════════════════════
// 🎯 CATÁLOGO PLANO (REAPER-style)
// ═══════════════════════════════════════════════════════════════

/**
 * Catálogo de categorías de Preferences, estructurado como REAPER.
 *
 * Reglas:
 *   • Categoría raíz: NO tiene `parentId`
 *   • Sub-categoría:  tiene `parentId` apuntando a una raíz
 *   • El orden del array = orden de aparición en el sidebar
 *   • `placeholder: true` → panel "coming soon"
 *
 * Para añadir un nuevo panel real:
 *   1. Marca `placeholder: false` (o elimina la propiedad)
 *   2. Crea el componente del panel en `panels/`
 *   3. Regístralo en `PreferencesContent.tsx`
 */
export const PREFERENCES_CATALOG: readonly PreferenceCategory[] = [
  // ═══════════════════════════════════════════════════════════
  // Item Loop Defaults (raíz suelta, sin hijos)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'item-loop-defaults',
    label: 'Item Loop Defaults',
    description: 'Defaults de looping para nuevos items',
    placeholder: true,
  },

  // ═══════════════════════════════════════════════════════════
  // Audio
  // ═══════════════════════════════════════════════════════════
  {
    id: 'audio',
    label: 'Audio',
    description: 'Configuración del motor de audio',
    placeholder: true,
  },
  {
    id: 'audio.device',
    label: 'Device',
    parentId: 'audio',
    description: 'Dispositivo de salida y buffer size',
    placeholder: true,
  },
  {
    id: 'audio.midi-inputs',
    label: 'MIDI Inputs',
    parentId: 'audio',
    description: 'Puertos MIDI de entrada',
    placeholder: true,
  },
  {
    id: 'audio.midi-outputs',
    label: 'MIDI Outputs',
    parentId: 'audio',
    description: 'Puertos MIDI de salida',
    placeholder: true,
  },
  {
    id: 'audio.buffering',
    label: 'Buffering',
    parentId: 'audio',
    description: 'Tamaño de buffers y latencia',
    placeholder: true,
  },
  {
    id: 'audio.mute-solo',
    label: 'Mute/Solo',
    parentId: 'audio',
    description: 'Comportamiento de mute y solo',
    placeholder: true,
  },
  {
    id: 'audio.playback',
    label: 'Playback',
    parentId: 'audio',
    description: 'Opciones de reproducción',
    placeholder: true,
  },
  {
    id: 'audio.scrub-jog',
    label: 'Scrub/Jog',
    parentId: 'audio',
    description: 'Scrubbing y control de jog',
    placeholder: true,
  },
  {
    id: 'audio.seeking',
    label: 'Seeking',
    parentId: 'audio',
    description: 'Comportamiento al buscar posición',
    placeholder: true,
  },
  {
    id: 'audio.recording',
    label: 'Recording',
    parentId: 'audio',
    description: 'Formato, sample rate y count-in',
    placeholder: true,
  },
  {
    id: 'audio.loop-lane-recording',
    label: 'Loop/Lane Recording',
    parentId: 'audio',
    description: 'Grabación en loop y takes por lane',
    placeholder: true,
  },
  {
    id: 'audio.rendering',
    label: 'Rendering',
    parentId: 'audio',
    description: 'Opciones de renderizado offline',
    placeholder: true,
  },

  // ═══════════════════════════════════════════════════════════
  // Appearance
  // ═══════════════════════════════════════════════════════════
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Colores, tema y densidad de la UI',
    placeholder: true,
  },
  {
    id: 'appearance.ruler-grid',
    label: 'Ruler/Grid',
    parentId: 'appearance',
    description: 'Regla de tiempo y grid del timeline',
    placeholder: true,
  },
  {
    id: 'appearance.media-items',
    label: 'Media Items',
    parentId: 'appearance',
    description: 'Aspecto de los items de media',
    placeholder: true,
  },
  {
    id: 'appearance.media-item-buttons',
    label: 'Media Item Buttons',
    parentId: 'appearance',
    description: 'Botones sobre los items',
    placeholder: true,
  },
  {
    id: 'appearance.peaks-waveforms',
    label: 'Peaks/Waveforms',
    parentId: 'appearance',
    description: 'Renderizado de waveforms',
    placeholder: true,
  },
  {
    id: 'appearance.fades-crossfades',
    label: 'Fades/Crossfades',
    parentId: 'appearance',
    description: 'Visualización de fades y crossfades',
    placeholder: true,
  },
  {
    id: 'appearance.track-control-panels',
    label: 'Track Control Panels',
    parentId: 'appearance',
    description: 'Aspecto de los headers de track',
    placeholder: true,
  },
  {
    id: 'appearance.track-meters',
    label: 'Track Meters',
    parentId: 'appearance',
    description: 'Medidores de nivel por track',
    placeholder: true,
  },
  {
    id: 'appearance.zoom-scroll-offset',
    label: 'Zoom/Scroll/Offset',
    parentId: 'appearance',
    description: 'Comportamiento de zoom y scroll',
    placeholder: true,
  },
  {
    id: 'appearance.envelope-colors',
    label: 'Envelope Colors',
    parentId: 'appearance',
    description: 'Colores de las envolventes',
    placeholder: true,
  },

  // ═══════════════════════════════════════════════════════════
  // Editing Behavior
  // ═══════════════════════════════════════════════════════════
  {
    id: 'editing',
    label: 'Editing Behavior',
    description: 'Comportamiento de edición y navegación',
    placeholder: true,
  },
  {
    id: 'editing.envelope-display',
    label: 'Envelope Display',
    parentId: 'editing',
    description: 'Visualización de envolventes en edición',
    placeholder: true,
  },
  {
    id: 'editing.automation',
    label: 'Automation',
    parentId: 'editing',
    description: 'Modo de automation y grabación',
    placeholder: true,
  },
  {
    id: 'editing.media-item-locking',
    label: 'Media Item Locking',
    parentId: 'editing',
    description: 'Bloqueo de items para edición',
    placeholder: true,
  },
  {
    id: 'editing.automation-items',
    label: 'Automation Items',
    parentId: 'editing',
    description: 'Items de automation',
    placeholder: true,
  },
  {
    id: 'editing.fixed-lane-comping',
    label: 'Fixed Lane Comping',
    parentId: 'editing',
    description: 'Comping en fixed lanes',
    placeholder: true,
  },
  {
    id: 'editing.mouse',
    label: 'Mouse',
    parentId: 'editing',
    description: 'Comportamiento del ratón',
    placeholder: true,
  },
  {
    id: 'editing.mouse-modifiers',
    label: 'Mouse Modifiers',
    parentId: 'editing',
    description: 'Modificadores del ratón (Ctrl, Shift, Alt)',
    placeholder: true,
  },
  {
    id: 'editing.midi-editor',
    label: 'MIDI Editor',
    parentId: 'editing',
    description: 'Comportamiento del editor MIDI',
    placeholder: true,
  },
  {
    id: 'editing.spectral-edits',
    label: 'Spectral Edits',
    parentId: 'editing',
    description: 'Edición espectral',
    placeholder: true,
  },

  // ═══════════════════════════════════════════════════════════
  // Media
  // ═══════════════════════════════════════════════════════════
  {
    id: 'media',
    label: 'Media',
    description: 'Importación y manejo de archivos multimedia',
    placeholder: true,
  },
  {
    id: 'media.midi',
    label: 'MIDI',
    parentId: 'media',
    description: 'Opciones MIDI para media',
    placeholder: true,
  },
  {
    id: 'media.peaks-generation',
    label: 'Peaks Generation',
    parentId: 'media',
    description: 'Generación de peaks/waveforms',
    placeholder: true,
  },
  {
    id: 'media.video',
    label: 'Video',
    parentId: 'media',
    description: 'Reproducción y decodificación de video',
    placeholder: true,
  },
  {
    id: 'media.import',
    label: 'Import',
    parentId: 'media',
    description: 'Opciones al importar audio',
    placeholder: true,
  },

  // ═══════════════════════════════════════════════════════════
  // Plug-ins
  // ═══════════════════════════════════════════════════════════
  {
    id: 'plugins',
    label: 'Plug-ins',
    description: 'Gestión y comportamiento de plugins',
    placeholder: true,
  },
  {
    id: 'plugins.compatibility',
    label: 'Compatibility',
    parentId: 'plugins',
    description: 'Modos de compatibilidad para plugins problemáticos',
    placeholder: true,
  },
  {
    // ✅ Panel real implementado (primer panel funcional del catálogo)
    id: 'plugins.vst',
    label: 'VST',
    parentId: 'plugins',
    description: 'Configuración de plugins VST y VST3',
  },
  {
    id: 'plugins.lv2-clap',
    label: 'LV2/CLAP',
    parentId: 'plugins',
    description: 'Plugins LV2 y CLAP',
    placeholder: true,
  },
  {
    id: 'plugins.ara',
    label: 'ARA',
    parentId: 'plugins',
    description: 'Audio Random Access',
    placeholder: true,
  },
  {
    id: 'plugins.rewire-dx',
    label: 'ReWire/DX',
    parentId: 'plugins',
    description: 'ReWire y DirectX plugins',
    placeholder: true,
  },
  {
    id: 'plugins.reascript',
    label: 'ReaScript',
    parentId: 'plugins',
    description: 'Scripts Lua/EEL/Python',
    placeholder: true,
  },

  // ═══════════════════════════════════════════════════════════
  // Control/OSC/web (raíz suelta, sin hijos)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'control-osc-web',
    label: 'Control/OSC/web',
    description: 'Superficies de control, OSC y control web',
    placeholder: true,
  },

  // ═══════════════════════════════════════════════════════════
  // External Editors (raíz suelta, sin hijos)
  // ═══════════════════════════════════════════════════════════
  {
    id: 'external-editors',
    label: 'External Editors',
    description: 'Editores externos para archivos de audio',
    placeholder: true,
  },
] as const;

// ═══════════════════════════════════════════════════════════════
// 🛠️ HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Devuelve la categoría con el `id` dado, o `null` si no existe.
 */
export function findCategoryById(
  id: string
): PreferenceCategory | null {
  return PREFERENCES_CATALOG.find((c) => c.id === id) ?? null;
}

/**
 * Devuelve el ID de la primera categoría del catálogo.
 * Usado como selección por defecto al abrir Preferences.
 */
export function getDefaultCategoryId(): string {
  return PREFERENCES_CATALOG[0]?.id ?? '';
}

/**
 * Construye el árbol jerárquico raíz → hijos a partir del catálogo plano.
 *
 * Reglas:
 *   • Categorías raíz (sin parentId) aparecen en orden del catálogo
 *   • Hijos aparecen en orden del catálogo, agrupados bajo su padre
 *   • Categorías con parentId huérfano (padre inexistente) se ignoran
 *
 * El resultado es un array de nodos raíz, cada uno con sus children.
 */
export function buildCategoryTree(): readonly PreferenceCategoryNode[] {
  const rootIds = new Set(
    PREFERENCES_CATALOG
      .filter((c) => !c.parentId)
      .map((c) => c.id)
  );

  const childrenByParentId = new Map<string, PreferenceCategory[]>();

  for (const cat of PREFERENCES_CATALOG) {
    if (!cat.parentId) continue;
    if (!rootIds.has(cat.parentId)) continue; // huérfano → se ignora
    const list = childrenByParentId.get(cat.parentId) ?? [];
    list.push(cat);
    childrenByParentId.set(cat.parentId, list);
  }

  return PREFERENCES_CATALOG
    .filter((c) => !c.parentId)
    .map<PreferenceCategoryNode>((root) => ({
      category: root,
      children: (childrenByParentId.get(root.id) ?? []).map((child) => ({
        category: child,
        children: [], // solo 1 nivel de anidación
      })),
    }));
}