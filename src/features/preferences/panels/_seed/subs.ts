// src/features/preferences/panels/_seed/subs.ts

import type { PreferencePanelEntry } from '@features/preferences/registry';

// ═══════════════════════════════════════════════════════════════
// 🌱 SEED — SUB-CATEGORÍAS (placeholders temporales)
// ═══════════════════════════════════════════════════════════════

/*
 * ─── PROPÓSITO ────────────────────────────────────────────────
 * Registra TEMPORALMENTE todas las sub-categorías del árbol de
 * Preferences que aún no tienen panel real implementado.
 *
 * Cuando implementes el panel real de una sub-categoría:
 *   1. Elimina su entry de este archivo
 *   2. Crea carpeta panels/[nombre-panel]/ con:
 *        - index.ts (registration con component + defaults)
 *        - [Nombre]Panel.tsx
 *        - [Nombre]Panel.css
 *   3. El sidebar seguirá mostrándolo en la misma posición
 *      gracias al `parentId` + `order`
 *
 * ─── EJEMPLO YA MIGRADO ───────────────────────────────────────
 * `plugins.vst` NO está en este seed — vive en su propia carpeta
 * `panels/vst/` porque tiene panel real. Sirve de referencia
 * para tu amigo (o tú) de cómo migrar cualquier otra.
 *
 * ─── ORDEN ────────────────────────────────────────────────────
 * Multiplicamos por 10 (10, 20, 30...) para permitir inserciones
 * intermedias sin renumerar.
 */

export const registration: PreferencePanelEntry[] = [
  // ═══════════════════════════════════════════════════════════
  // AUDIO
  // ═══════════════════════════════════════════════════════════
  {
    id: 'audio.device',
    parentId: 'audio',
    label: 'Device',
    description: 'Dispositivo de salida y buffer size',
    order: 10,
  },
  {
    id: 'audio.midi-inputs',
    parentId: 'audio',
    label: 'MIDI Inputs',
    description: 'Puertos MIDI de entrada',
    order: 20,
  },
  {
    id: 'audio.midi-outputs',
    parentId: 'audio',
    label: 'MIDI Outputs',
    description: 'Puertos MIDI de salida',
    order: 30,
  },
  {
    id: 'audio.buffering',
    parentId: 'audio',
    label: 'Buffering',
    description: 'Tamaño de buffers y latencia',
    order: 40,
  },
  {
    id: 'audio.mute-solo',
    parentId: 'audio',
    label: 'Mute/Solo',
    description: 'Comportamiento de mute y solo',
    order: 50,
  },
  {
    id: 'audio.playback',
    parentId: 'audio',
    label: 'Playback',
    description: 'Opciones de reproducción',
    order: 60,
  },
  {
    id: 'audio.scrub-jog',
    parentId: 'audio',
    label: 'Scrub/Jog',
    description: 'Scrubbing y control de jog',
    order: 70,
  },
  {
    id: 'audio.seeking',
    parentId: 'audio',
    label: 'Seeking',
    description: 'Comportamiento al buscar posición',
    order: 80,
  },
  {
    id: 'audio.recording',
    parentId: 'audio',
    label: 'Recording',
    description: 'Formato, sample rate y count-in',
    order: 90,
  },
  {
    id: 'audio.loop-lane-recording',
    parentId: 'audio',
    label: 'Loop/Lane Recording',
    description: 'Grabación en loop y takes por lane',
    order: 100,
  },
  {
    id: 'audio.rendering',
    parentId: 'audio',
    label: 'Rendering',
    description: 'Opciones de renderizado offline',
    order: 110,
  },

  // ═══════════════════════════════════════════════════════════
  // APPEARANCE
  // ═══════════════════════════════════════════════════════════
  {
    id: 'appearance.ruler-grid',
    parentId: 'appearance',
    label: 'Ruler/Grid',
    description: 'Regla de tiempo y grid del timeline',
    order: 10,
  },
  {
    id: 'appearance.media-items',
    parentId: 'appearance',
    label: 'Media Items',
    description: 'Aspecto de los items de media',
    order: 20,
  },
  {
    id: 'appearance.media-item-buttons',
    parentId: 'appearance',
    label: 'Media Item Buttons',
    description: 'Botones sobre los items',
    order: 30,
  },
  {
    id: 'appearance.peaks-waveforms',
    parentId: 'appearance',
    label: 'Peaks/Waveforms',
    description: 'Renderizado de waveforms',
    order: 40,
  },
  {
    id: 'appearance.fades-crossfades',
    parentId: 'appearance',
    label: 'Fades/Crossfades',
    description: 'Visualización de fades y crossfades',
    order: 50,
  },
  {
    id: 'appearance.track-control-panels',
    parentId: 'appearance',
    label: 'Track Control Panels',
    description: 'Aspecto de los headers de track',
    order: 60,
  },
  {
    id: 'appearance.track-meters',
    parentId: 'appearance',
    label: 'Track Meters',
    description: 'Medidores de nivel por track',
    order: 70,
  },
  {
    id: 'appearance.zoom-scroll-offset',
    parentId: 'appearance',
    label: 'Zoom/Scroll/Offset',
    description: 'Comportamiento de zoom y scroll',
    order: 80,
  },
  {
    id: 'appearance.envelope-colors',
    parentId: 'appearance',
    label: 'Envelope Colors',
    description: 'Colores de las envolventes',
    order: 90,
  },

  // ═══════════════════════════════════════════════════════════
  // EDITING BEHAVIOR
  // ═══════════════════════════════════════════════════════════
  {
    id: 'editing.envelope-display',
    parentId: 'editing',
    label: 'Envelope Display',
    description: 'Visualización de envolventes en edición',
    order: 10,
  },
  {
    id: 'editing.automation',
    parentId: 'editing',
    label: 'Automation',
    description: 'Modo de automation y grabación',
    order: 20,
  },
  {
    id: 'editing.media-item-locking',
    parentId: 'editing',
    label: 'Media Item Locking',
    description: 'Bloqueo de items para edición',
    order: 30,
  },
  {
    id: 'editing.automation-items',
    parentId: 'editing',
    label: 'Automation Items',
    description: 'Items de automation',
    order: 40,
  },
  {
    id: 'editing.fixed-lane-comping',
    parentId: 'editing',
    label: 'Fixed Lane Comping',
    description: 'Comping en fixed lanes',
    order: 50,
  },
  {
    id: 'editing.mouse',
    parentId: 'editing',
    label: 'Mouse',
    description: 'Comportamiento del ratón',
    order: 60,
  },
  {
    id: 'editing.mouse-modifiers',
    parentId: 'editing',
    label: 'Mouse Modifiers',
    description: 'Modificadores del ratón (Ctrl, Shift, Alt)',
    order: 70,
  },
  {
    id: 'editing.midi-editor',
    parentId: 'editing',
    label: 'MIDI Editor',
    description: 'Comportamiento del editor MIDI',
    order: 80,
  },
  {
    id: 'editing.spectral-edits',
    parentId: 'editing',
    label: 'Spectral Edits',
    description: 'Edición espectral',
    order: 90,
  },

  // ═══════════════════════════════════════════════════════════
  // MEDIA
  // ═══════════════════════════════════════════════════════════
  {
    id: 'media.midi',
    parentId: 'media',
    label: 'MIDI',
    description: 'Opciones MIDI para media',
    order: 10,
  },
  {
    id: 'media.peaks-generation',
    parentId: 'media',
    label: 'Peaks Generation',
    description: 'Generación de peaks/waveforms',
    order: 20,
  },
  {
    id: 'media.video',
    parentId: 'media',
    label: 'Video',
    description: 'Reproducción y decodificación de video',
    order: 30,
  },
  {
    id: 'media.import',
    parentId: 'media',
    label: 'Import',
    description: 'Opciones al importar audio',
    order: 40,
  },

  // ═══════════════════════════════════════════════════════════
  // PLUG-INS
  // ═══════════════════════════════════════════════════════════
  {
    id: 'plugins.compatibility',
    parentId: 'plugins',
    label: 'Compatibility',
    description: 'Modos de compatibilidad para plugins problemáticos',
    order: 10,
  },
  /*
   * NOTA: `plugins.vst` NO está aquí — tiene panel real y vive
   * en `panels/vst/` con su registration propia (order: 20).
   */
  {
    id: 'plugins.lv2-clap',
    parentId: 'plugins',
    label: 'LV2/CLAP',
    description: 'Plugins LV2 y CLAP',
    order: 30,
  },
  {
    id: 'plugins.ara',
    parentId: 'plugins',
    label: 'ARA',
    description: 'Audio Random Access',
    order: 40,
  },
  {
    id: 'plugins.rewire-dx',
    parentId: 'plugins',
    label: 'ReWire/DX',
    description: 'ReWire y DirectX plugins',
    order: 50,
  },
  {
    id: 'plugins.reascript',
    parentId: 'plugins',
    label: 'ReaScript',
    description: 'Scripts Lua/EEL/Python',
    order: 60,
  },
];