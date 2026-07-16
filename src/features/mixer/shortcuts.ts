// src/features/mixer/shortcuts.ts

import { toggleMixer } from '@state/slices/ui/uiSlice';
import { deleteSelectedTrack } from '@state/slices/tracks/tracksThunks';
import type { ShortcutRegistration, ShortcutCtx } from '@services/shortcuts/registry';

// ═══════════════════════════════════════════════════════════════
// 🎯 HELPERS PRIVADOS (solo mixer)
// ═══════════════════════════════════════════════════════════════

function ifTrackSelected(ctx: ShortcutCtx, action: () => void): void {
  if (!ctx.getState().tracks.selectedTrackId) return;
  action();
}

// ═══════════════════════════════════════════════════════════════
// 📤 REGISTRATION
// ═══════════════════════════════════════════════════════════════

export const registration: ShortcutRegistration = {
  id: 'mixer',
  label: '🎚️ Mixer',
  build: (ctx) => {
    const deleteTrack = () =>
      ifTrackSelected(ctx, () => ctx.dispatch(deleteSelectedTrack()));

    return [
      {
        keys: 'm',
        description: 'Mostrar / Ocultar Mixer',
        category: '🖥️ Vista',
        handler: () => ctx.dispatch(toggleMixer()),
      },
      {
        keys: 'ctrl+x',
        description: 'Cortar / eliminar track seleccionado',
        category: '🎚️ Tracks',
        handler: deleteTrack,
      },
      {
        keys: 'delete',
        description: 'Eliminar track seleccionado',
        category: '🎚️ Tracks',
        handler: deleteTrack,
      },
      {
        keys: 'backspace',
        description: 'Eliminar track seleccionado',
        category: '🎚️ Tracks',
        handler: deleteTrack,
      },
    ];
  },
};