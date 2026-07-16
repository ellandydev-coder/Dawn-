// src/state/middleware/audioSync/registry/bootstrap.ts

import { loadFromGlob } from '@shared/registry/createRegistry';
import type { GlobModule } from '@shared/registry/registry.types';
import { audioSyncHandlersRegistry } from './audioSyncHandlersRegistry';
import type { AudioSyncHandlerRegistration } from './audioSyncHandlers.types';
import type { AppStartListening } from '../types';

// ═══════════════════════════════════════════════════════════════
// 🎯 GLOB — descubre handlers/*.ts automáticamente
// ═══════════════════════════════════════════════════════════════

/**
 * Un solo glob wildcard descubre TODOS los handlers en la carpeta.
 * Cero mantenimiento al añadir handlers nuevos: crea archivo y ya.
 */
const modules = import.meta.glob<GlobModule<AudioSyncHandlerRegistration>>(
  '../handlers/*.ts',
  { eager: true }
);

// ═══════════════════════════════════════════════════════════════
// 🎯 BOOTSTRAP
// ═══════════════════════════════════════════════════════════════

/**
 * Bootstrap del sistema de handlers de audio sync distribuido.
 *
 * 1. Limpia el registry (idempotente para React.StrictMode DEV)
 * 2. Descubre todos los `handlers/*.ts` via glob
 * 3. Llama a `register(startAppListening)` de cada grupo descubierto
 *
 * ─── Para añadir handlers de un dominio nuevo ──────────────────
 *   1. Crear `src/state/middleware/audioSync/handlers/miDominioHandlers.ts`
 *   2. Implementar `registerMiDominioHandlers(startAppListening)`
 *   3. Exportar `registration: AudioSyncHandlerRegistration`
 *   4. Reiniciar (o esperar HMR) — se descubren automáticamente
 *
 * ⚠️  NO llamar a `bootstrapAudioSyncHandlers()` desde código de features.
 * Se llama UNA vez desde `audioSync/index.ts` (el middleware).
 */
export function bootstrapAudioSyncHandlers(
  startAppListening: AppStartListening
): void {
  // 1. Limpiar el registry (StrictMode DEV puede llamar 2 veces)
  audioSyncHandlersRegistry.clear();

  // 2. Cargar todos los grupos descubiertos
  const discoveredCount = loadFromGlob(audioSyncHandlersRegistry, modules);

  // 3. Ejecutar el register() de cada grupo
  for (const entry of audioSyncHandlersRegistry.getAll()) {
    entry.register(startAppListening);
  }

  if (import.meta.env.DEV) {
    console.info(
      `%c[audioSync] Handlers listos: ${discoveredCount} grupos registrados`,
      'color:#38bdf8;font-weight:bold'
    );
  }
}