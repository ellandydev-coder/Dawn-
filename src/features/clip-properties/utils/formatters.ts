// src/features/clip-properties/utils/formatters.ts
// ═══════════════════════════════════════════════════════════════
// 🛠️ Helpers de formato (estilo REAPER)
// ═══════════════════════════════════════════════════════════════

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.000';
  const totalMs = Math.round(seconds * 1000);
  const mins = Math.floor(totalMs / 60_000);
  const secs = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${mins}:${secs.toString().padStart(2, '0')}.${ms
    .toString()
    .padStart(3, '0')}`;
}

export function parseTime(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.includes(':')) {
    const [minsStr, secsStr] = trimmed.split(':');
    const mins = Number(minsStr);
    const secs = Number(secsStr);
    if (!Number.isFinite(mins) || !Number.isFinite(secs)) return null;
    if (mins < 0 || secs < 0 || secs >= 60) return null;
    return mins * 60 + secs;
  }

  const num = Number(trimmed);
  return Number.isFinite(num) && num >= 0 ? num : null;
}

export function formatSampleRate(hz: number): string {
  if (!Number.isFinite(hz) || hz <= 0) return '—';
  return `${(hz / 1000).toFixed(1).replace(/\.0$/, '')} kHz`;
}

export function formatChannels(n: number): string {
  if (n === 1) return 'mono';
  if (n === 2) return 'stereo';
  if (!Number.isFinite(n) || n <= 0) return '—';
  return `${n}ch`;
}

export function formatFileSize(bytes: number | undefined): string {
  if (bytes === undefined || !Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}