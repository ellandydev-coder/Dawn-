/**
 * keyboardShortcuts.ts
 * --------------------
 * Registro DECLARATIVO de todos los atajos globales de la DAW.
 * Se ejecuta una vez desde AppProviders / GlobalShortcuts.
 *
 * ARQUITECTURA:
 *  - Categorías tipadas (const assertion)
 *  - Constantes nombradas (sin magic numbers)
 *  - Handlers agrupados por función (Transport, Navigation, etc.)
 *  - Guards reutilizables (requireSelectedTrack, etc.)
 *  - Type-safe end-to-end
 *
 * ESTILO REAPER (Edit Cursor + Play Cursor):
 *  - Space          → Play/Pause desde el edit cursor
 *  - Shift+Space    → Play desde el inicio
 *  - Enter          → Stop total (ambos cursores a 0)
 *  - Home / W       → Edit cursor al inicio
 *
 * GRABACIÓN:
 *  - Si estás grabando o en count-in, Space/Enter/Shift+Space/R
 *    detienen la grabación limpiamente vía toggleRecord()
 *    en lugar de dejarla colgada. Además, el playhead se detiene
 *    con pause() para que el cursor no siga avanzando.
 *
 * UNDO / REDO (por gesto, estilo REAPER):
 *  - Ctrl+Z         → Deshacer último gesto (fader, knob, etc.)
 *  - Ctrl+Shift+Z   → Rehacer
 *  - Ctrl+Y         → Rehacer (alternativa Windows)
 *
 * AGREGAR UN SHORTCUT NUEVO:
 *  1. Agrégalo al grupo correspondiente (transportShortcuts, etc.)
 *  2. Si es un grupo nuevo, créalo como función y añádelo a ALL_GROUPS
 */

import type { Store } from '@reduxjs/toolkit';
import type { RootState, AppDispatch } from '@state/store';
import type { ShortcutDefinition } from '@services/shortcuts/shortcutTypes';
import { shortcutManager } from '@services/shortcuts/ShortcutManager';

import {
  play,
  pause,
  stopAndRewind,
  setEditCursor,
  toggleRecord,
  toggleLoop,
  toggleMetronome,
} from '@state/slices/transport/transportSlice';
import {
  toggleMixer,
  toggleDebug,
  toggleShortcutsOverlay,
  setShortcutsOverlay,
  togglePreferences,
} from '@state/slices/ui/uiSlice';
import { deleteSelectedTrack } from '@state/slices/tracks/tracksThunks';
import { undo, redo } from '@state/slices/history/historySlice';

// ═══════════════════════════════════════════════════════════════
// 🎯 CONSTANTES TIPADAS
// ═══════════════════════════════════════════════════════════════

/**
 * Categorías de atajos (tipadas con `as const` para autocompletado
 * y prevención de typos).
 */
const CATEGORY = {
  TRANSPORT:  '🎬 Transport',
  NAVIGATION: '⏩ Navegación',
  TRACKS:     '🎚️ Tracks',
  VIEW:       '🖥️ Vista',
  HELP:       '❓ Ayuda',
  PROJECT:    '💾 Proyecto',
  EDIT:       '✏️ Edición',
} as const;

/**
 * Pasos de navegación en segundos.
 * Modificar aquí para cambiar el comportamiento globalmente.
 */
const NAV_STEP = {
  SMALL: 1,  // Left/Right
  LARGE: 5,  // Shift+Left/Right
} as const;

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS AUXILIARES
// ═══════════════════════════════════════════════════════════════

/**
 * Store tipado con AppDispatch para soportar thunks.
 */
export type TypedStore = Store<RootState> & { dispatch: AppDispatch };

/**
 * Contexto que se pasa a cada grupo de shortcuts.
 * Encapsula dispatch + getState para no depender del store completo.
 */
interface ShortcutCtx {
  readonly dispatch: AppDispatch;
  readonly getState: () => RootState;
}

/**
 * Shortcut sin `context` (se agrega automáticamente como 'global').
 */
type GlobalShortcut = Omit<ShortcutDefinition, 'context'>;

/**
 * Factory de grupo de shortcuts.
 */
type ShortcutGroup = (ctx: ShortcutCtx) => readonly GlobalShortcut[];

// ═══════════════════════════════════════════════════════════════
// 🎯 GUARDS REUTILIZABLES
// ═══════════════════════════════════════════════════════════════

/**
 * Ejecuta una acción SOLO si hay un track seleccionado.
 * Si no lo hay, permite que el navegador maneje el evento (ej: Ctrl+X nativo).
 */
function ifTrackSelected(ctx: ShortcutCtx, action: () => void): void {
  if (!ctx.getState().tracks.selectedTrackId) return;
  action();
}

/**
 * Salta el edit cursor `delta` segundos (con clamp a 0).
 */
function seekBy(ctx: ShortcutCtx, delta: number): void {
  const current = ctx.getState().transport.editCursorSeconds;
  const next = Math.max(0, current + delta);
  ctx.dispatch(setEditCursor(next));
}

/**
 * ¿La grabación está activa o en fase de count-in?
 * Si es así, cualquier atajo de "parar" debe usar toggleRecord()
 * para cerrar limpiamente el take en lugar de dejar el mic colgado.
 */
function isRecordingOrCountingIn(ctx: ShortcutCtx): boolean {
  const t = ctx.getState().transport;
  return t.isRecording || t.isCountingIn;
}

/**
 * Placeholder tipado para shortcuts pendientes de conectar.
 * Aparece en consola con warning claro (no console.info silencioso).
 */
function pending(feature: string): () => void {
  return () => {
    console.warn(`[Shortcut] "${feature}" aún no está conectado (TODO)`);
  };
}

// ═══════════════════════════════════════════════════════════════
// 🎬 GRUPO: TRANSPORT
// ═══════════════════════════════════════════════════════════════

const transportShortcuts: ShortcutGroup = (ctx) => [
  {
    keys: 'space',
    description: 'Play / Pause (desde edit cursor)',
    category: CATEGORY.TRANSPORT,
    handler: () => {
      if (isRecordingOrCountingIn(ctx)) {
        ctx.dispatch(toggleRecord());
        ctx.dispatch(pause());
        return;
      }

      const isPlaying = ctx.getState().transport.isPlaying;
      ctx.dispatch(isPlaying ? pause() : play());
    },
  },
  {
    keys: 'shift+space',
    description: 'Play desde el inicio',
    category: CATEGORY.TRANSPORT,
    handler: () => {
      if (isRecordingOrCountingIn(ctx)) {
        ctx.dispatch(toggleRecord());
        ctx.dispatch(pause());
      }

      ctx.dispatch(setEditCursor(0));
      ctx.dispatch(play());
    },
  },
  {
    keys: 'enter',
    description: 'Stop total (reset a 0)',
    category: CATEGORY.TRANSPORT,
    handler: () => {
      if (isRecordingOrCountingIn(ctx)) {
        ctx.dispatch(toggleRecord());
      }

      ctx.dispatch(stopAndRewind());
    },
  },
  {
    keys: 'r',
    description: 'Toggle Record',
    category: CATEGORY.TRANSPORT,
    handler: () => {
      if (isRecordingOrCountingIn(ctx)) {
        ctx.dispatch(toggleRecord());
        ctx.dispatch(pause());
        return;
      }

      ctx.dispatch(toggleRecord());
    },
  },
  {
    keys: 'home',
    description: 'Edit cursor al inicio',
    category: CATEGORY.TRANSPORT,
    handler: () => ctx.dispatch(setEditCursor(0)),
  },
  {
    keys: 'w',
    description: 'Rewind al inicio',
    category: CATEGORY.TRANSPORT,
    handler: () => ctx.dispatch(setEditCursor(0)),
  },
  {
    keys: 'l',
    description: 'Toggle Loop',
    category: CATEGORY.TRANSPORT,
    handler: () => ctx.dispatch(toggleLoop()),
  },
  {
    keys: 'ctrl+shift+m',
    description: 'Toggle Metrónomo',
    category: CATEGORY.TRANSPORT,
    handler: () => ctx.dispatch(toggleMetronome()),
  },
];

// ═══════════════════════════════════════════════════════════════
// ⏩ GRUPO: NAVEGACIÓN
// ═══════════════════════════════════════════════════════════════

const navigationShortcuts: ShortcutGroup = (ctx) => [
  {
    keys: 'left',
    description: `Retroceder ${NAV_STEP.SMALL} segundo`,
    category: CATEGORY.NAVIGATION,
    handler: () => seekBy(ctx, -NAV_STEP.SMALL),
  },
  {
    keys: 'right',
    description: `Avanzar ${NAV_STEP.SMALL} segundo`,
    category: CATEGORY.NAVIGATION,
    handler: () => seekBy(ctx, +NAV_STEP.SMALL),
  },
  {
    keys: 'shift+left',
    description: `Retroceder ${NAV_STEP.LARGE} segundos`,
    category: CATEGORY.NAVIGATION,
    handler: () => seekBy(ctx, -NAV_STEP.LARGE),
  },
  {
    keys: 'shift+right',
    description: `Avanzar ${NAV_STEP.LARGE} segundos`,
    category: CATEGORY.NAVIGATION,
    handler: () => seekBy(ctx, +NAV_STEP.LARGE),
  },
];

// ═══════════════════════════════════════════════════════════════
// 🎚️ GRUPO: TRACKS
// ═══════════════════════════════════════════════════════════════

const tracksShortcuts: ShortcutGroup = (ctx) => {
  const deleteTrack = () => ifTrackSelected(ctx, () => ctx.dispatch(deleteSelectedTrack()));

  return [
    {
      keys: 'ctrl+x',
      description: 'Cortar / eliminar track seleccionado',
      category: CATEGORY.TRACKS,
      handler: deleteTrack,
    },
    {
      keys: 'delete',
      description: 'Eliminar track seleccionado',
      category: CATEGORY.TRACKS,
      handler: deleteTrack,
    },
    {
      keys: 'backspace',
      description: 'Eliminar track seleccionado',
      category: CATEGORY.TRACKS,
      handler: deleteTrack,
    },
  ];
};

// ═══════════════════════════════════════════════════════════════
// 🖥️ GRUPO: VISTA
// ═══════════════════════════════════════════════════════════════

const viewShortcuts: ShortcutGroup = (ctx) => [
  {
    keys: 'm',
    description: 'Mostrar / Ocultar Mixer',
    category: CATEGORY.VIEW,
    handler: () => ctx.dispatch(toggleMixer()),
  },
  {
    keys: 'd',
    description: 'Mostrar / Ocultar Debug',
    category: CATEGORY.VIEW,
    handler: () => ctx.dispatch(toggleDebug()),
  },
  {
    keys: 'ctrl+p',
    description: 'Mostrar / Ocultar Preferences',
    category: CATEGORY.VIEW,
    /*
     * ⚠️  Ctrl+P es el atajo nativo del navegador para "Imprimir".
     * shortcutManager llama preventDefault() para evitar que se
     * abra el diálogo de impresión al pulsar Ctrl+P. Verificado
     * en Chrome/Edge/Firefox.
     */
    handler: () => ctx.dispatch(togglePreferences()),
  },
];

// ═══════════════════════════════════════════════════════════════
// ❓ GRUPO: AYUDA
// ═══════════════════════════════════════════════════════════════

const helpShortcuts: ShortcutGroup = (ctx) => [
  {
    keys: 'f1',
    description: 'Mostrar atajos de teclado',
    category: CATEGORY.HELP,
    handler: () => ctx.dispatch(toggleShortcutsOverlay()),
  },
  {
    keys: 'shift+/',
    description: 'Mostrar atajos de teclado (?)',
    category: CATEGORY.HELP,
    handler: () => ctx.dispatch(toggleShortcutsOverlay()),
  },
  {
    keys: 'esc',
    description: 'Cerrar diálogos / atajos',
    category: CATEGORY.HELP,
    allowInInputs: true,
    handler: () => {
      if (ctx.getState().ui.showShortcutsOverlay) {
        ctx.dispatch(setShortcutsOverlay(false));
      }
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// 💾 GRUPO: PROYECTO
// ═══════════════════════════════════════════════════════════════

const projectShortcuts: ShortcutGroup = (_ctx) => [
  {
    keys: 'ctrl+s',
    description: 'Guardar proyecto',
    category: CATEGORY.PROJECT,
    handler: pending('Guardar proyecto'),
  },
];

// ═══════════════════════════════════════════════════════════════
// ✏️ GRUPO: EDICIÓN (Undo / Redo por gesto)
// ═══════════════════════════════════════════════════════════════

const editShortcuts: ShortcutGroup = (ctx) => [
  {
    keys: 'ctrl+z',
    description: 'Deshacer último gesto',
    category: CATEGORY.EDIT,
    handler: () => {
      if (ctx.getState().history.past.length === 0) return;
      ctx.dispatch(undo());
    },
  },
  {
    keys: 'ctrl+shift+z',
    description: 'Rehacer último gesto',
    category: CATEGORY.EDIT,
    handler: () => {
      if (ctx.getState().history.future.length === 0) return;
      ctx.dispatch(redo());
    },
  },
  {
    keys: 'ctrl+y',
    description: 'Rehacer último gesto (alternativo Windows)',
    category: CATEGORY.EDIT,
    handler: () => {
      if (ctx.getState().history.future.length === 0) return;
      ctx.dispatch(redo());
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// 🎯 REGISTRO CENTRAL
// ═══════════════════════════════════════════════════════════════

/**
 * Todos los grupos de shortcuts globales.
 * Para agregar un grupo nuevo: créalo arriba y añádelo a este array.
 */
const ALL_GROUPS: readonly ShortcutGroup[] = [
  transportShortcuts,
  navigationShortcuts,
  tracksShortcuts,
  viewShortcuts,
  helpShortcuts,
  projectShortcuts,
  editShortcuts,
] as const;

/**
 * Registra todos los atajos globales de la DAW.
 *
 * @param store - Store tipado de Redux
 * @returns Función de limpieza que desregistra todos los atajos
 *
 * @example
 * ```ts
 * const cleanup = registerGlobalShortcuts(store);
 * // ... más tarde:
 * cleanup();
 * ```
 */
export function registerGlobalShortcuts(store: TypedStore): () => void {
  const ctx: ShortcutCtx = {
    dispatch: store.dispatch,
    getState: store.getState,
  };

  const allShortcuts = ALL_GROUPS.flatMap((group) => group(ctx));

  const unregisters = allShortcuts.map((shortcut) =>
    shortcutManager.register({
      ...shortcut,
      context: 'global',
    })
  );

  if (import.meta.env.DEV) {
    console.info(
      `%c⌨ Registrados ${allShortcuts.length} atajos globales`,
      'color:#4ade80;font-weight:bold'
    );
  }

  return () => {
    unregisters.forEach((unregister) => unregister());
  };
}