// src/state/middleware/audioSync/registry/audioSyncHandlers.types.ts

import type { RegistryEntry } from '@shared/registry/registry.types';
import type { AppStartListening } from '../types';

// ═══════════════════════════════════════════════════════════════
// 🎯 TIPOS
// ═══════════════════════════════════════════════════════════════

/**
 * Función registradora de handlers de audio sync.
 *
 * Recibe el `startAppListening` tipado del middleware y registra
 * uno o más listeners internamente. Es el patrón que ya usaban los
 * `registerXxxHandlers` originales — no cambia.
 */
export type AudioSyncHandlerRegisterFn = (
  startAppListening: AppStartListening
) => void;

/**
 * Registration de un grupo de handlers de audio sync.
 *
 * ─── CAMPOS OBLIGATORIOS ───
 *   • id       → id del grupo (ej: "mixer", "transport", "recording")
 *   • register → función que registra los listeners con startAppListening
 *
 * ─── EJEMPLO ───
 * ```ts
 * // handlers/mixerHandlers.ts
 * import type { AudioSyncHandlerRegistration } from '../registry';
 *
 * export function registerMixerHandlers(startAppListening: AppStartListening): void {
 *   // ... startAppListening({ ... })
 * }
 *
 * export const registration: AudioSyncHandlerRegistration = {
 *   id: 'mixer',
 *   register: registerMixerHandlers,
 * };
 * ```
 *
 * ─── CONVENCIÓN ───
 *   El `id` debe ser único y coincidir con el dominio del handler
 *   (mixer, tracks, transport, recording, monitoring, metronome, project).
 */
export interface AudioSyncHandlerRegistration extends RegistryEntry {
  /** Id del grupo (dominio del handler) */
  readonly id: string;

  /** Función que registra los listeners internamente */
  readonly register: AudioSyncHandlerRegisterFn;
}