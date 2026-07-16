// src/features/transport/shortcuts.ts

import {
  play,
  pause,
  stopAndRewind,
  setEditCursor,
  toggleRecord,
  toggleLoop,
  toggleMetronome,
} from '@state/slices/transport/transportSlice';
import type { ShortcutRegistration, ShortcutCtx } from '@services/shortcuts/registry';

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS PRIVADOS (solo transport)
// ═══════════════════════════════════════════════════════════════

function isRecordingOrCountingIn(ctx: ShortcutCtx): boolean {
  const t = ctx.getState().transport;
  return t.isRecording || t.isCountingIn;
}

function seekBy(ctx: ShortcutCtx, delta: number): void {
  const current = ctx.getState().transport.editCursorSeconds;
  const next = Math.max(0, current + delta);
  ctx.dispatch(setEditCursor(next));
}

const NAV_STEP = { SMALL: 1, LARGE: 5 } as const;

// ═══════════════════════════════════════════════════════════════
// 📤 REGISTRATION
// ═══════════════════════════════════════════════════════════════

export const registration: ShortcutRegistration = {
  id: 'transport',
  label: '🎬 Transport',
  build: (ctx) => [
    // ── Transport ──────────────────────────────────────────────
    {
      keys: 'space',
      description: 'Play / Pause (desde edit cursor)',
      category: '🎬 Transport',
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
      category: '🎬 Transport',
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
      category: '🎬 Transport',
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
      category: '🎬 Transport',
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
      category: '🎬 Transport',
      handler: () => ctx.dispatch(setEditCursor(0)),
    },
    {
      keys: 'w',
      description: 'Rewind al inicio',
      category: '🎬 Transport',
      handler: () => ctx.dispatch(setEditCursor(0)),
    },
    {
      keys: 'l',
      description: 'Toggle Loop',
      category: '🎬 Transport',
      handler: () => ctx.dispatch(toggleLoop()),
    },
    {
      keys: 'ctrl+shift+m',
      description: 'Toggle Metrónomo',
      category: '🎬 Transport',
      handler: () => ctx.dispatch(toggleMetronome()),
    },
    // ── Navegación ─────────────────────────────────────────────
    {
      keys: 'left',
      description: `Retroceder ${NAV_STEP.SMALL} segundo`,
      category: '⏩ Navegación',
      handler: () => seekBy(ctx, -NAV_STEP.SMALL),
    },
    {
      keys: 'right',
      description: `Avanzar ${NAV_STEP.SMALL} segundo`,
      category: '⏩ Navegación',
      handler: () => seekBy(ctx, +NAV_STEP.SMALL),
    },
    {
      keys: 'shift+left',
      description: `Retroceder ${NAV_STEP.LARGE} segundos`,
      category: '⏩ Navegación',
      handler: () => seekBy(ctx, -NAV_STEP.LARGE),
    },
    {
      keys: 'shift+right',
      description: `Avanzar ${NAV_STEP.LARGE} segundos`,
      category: '⏩ Navegación',
      handler: () => seekBy(ctx, +NAV_STEP.LARGE),
    },
  ],
};