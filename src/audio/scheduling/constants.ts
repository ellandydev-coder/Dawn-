// src/audio/scheduling/constants.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 Constantes del sistema de scheduling
// --------------------------------------------------------------
// Sin dependencias. Puras. Compartidas por todos los sub-módulos.
// ═══════════════════════════════════════════════════════════════

/** Cada cuánto revisamos la ventana (ms) */
export const LOOKAHEAD_MS = 25;

/** Cuánto miramos hacia el futuro al agendar (segundos) */
export const SCHEDULE_AHEAD_S = 0.1;

/** ~30 FPS de actualización del playhead en Redux */
export const UI_UPDATE_MS = 33;

/** Tolerancia para detectar fin de loop (segundos) */
export const LOOP_EPSILON = 0.001;

/** Margen antes de limpiar clips terminados del map (segundos) */
export const CLEANUP_MARGIN_S = 0.5;

/** Protección contra crecimiento infinito del map de scheduled */
export const MAX_SCHEDULED_CLIPS = 1000;

/** Duración mínima significativa de un clip (segundos). Menor = ignorado */
export const MIN_CLIP_DURATION_S = 0.01;

/** Fade mínimo evitable en clicks (segundos) — 0.5ms */
export const ANTI_CLICK_FADE_S = 0.0005;

/** Umbral de cambio de playhead para dispatchar (segundos) */
export const PLAYHEAD_DISPATCH_EPSILON = 0.005;

/** Prefijo para logs */
export const LOG_PREFIX = '[TransportScheduler]';