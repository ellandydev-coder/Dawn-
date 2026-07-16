// src/state/middleware/audioSync/config.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 CONFIG + LOGGING del middleware audioSync
// ═══════════════════════════════════════════════════════════════

const VERBOSE = Boolean(import.meta.env?.DEV);
const LOG_PREFIX = '[audioSync]';

export function log(
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
): void {
  if (!VERBOSE && level === 'info') return;

  switch (level) {
    case 'error': console.error(LOG_PREFIX, message); break;
    case 'warn':  console.warn(LOG_PREFIX, message);  break;
    default:      console.info(LOG_PREFIX, message);
  }
}

export function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}