// src/audio/scheduling/ClipEnvelope.ts
// ═══════════════════════════════════════════════════════════════
// 🎯 ClipEnvelope — Envelope de ganancia del clip
// --------------------------------------------------------------
// Aplica fadeIn + gain + fadeOut usando AudioParam automation.
// Todos los cambios ocurren en el reloj del AudioContext → sample-accurate.
//
// Envelope shape:
//   ┌─── clipGain ──────────┐
//   │  ╱‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾‾╲ │
//   │ ╱                    ╲│
//   └╱─────────────────────╲┘
//   0  fadeIn      fadeOut  end
// ═══════════════════════════════════════════════════════════════

import { ANTI_CLICK_FADE_S } from './constants';

export interface EnvelopeParams {
  /** gain.AudioParam del GainNode del clip */
  readonly param: AudioParam;
  /** Tiempo AudioContext en que arranca */
  readonly startAt: number;
  /** Duración REAL que se reproducirá (post-offset) */
  readonly playedDuration: number;
  /** Ganancia constante base del clip (0..2) */
  readonly clipGain: number;
  /** Duración fade-in desde el INICIO del clip */
  readonly fadeIn: number;
  /** Duración fade-out hacia el FINAL del clip */
  readonly fadeOut: number;
  /** Offset del catch-up mid-clip */
  readonly playbackOffset: number;
  /** Duración total del clip en la timeline */
  readonly originalDuration: number;
}

/**
 * Aplica el envelope de ganancia sobre un AudioParam.
 * Función pura desde el punto de vista de este módulo (todo el
 * efecto ocurre sobre `param` vía AudioParam automation).
 */
export function applyClipEnvelope(params: EnvelopeParams): void {
  const {
    param,
    startAt,
    playedDuration,
    clipGain,
    fadeIn,
    fadeOut,
    playbackOffset,
    originalDuration,
  } = params;

  const safeGain = Math.max(0, clipGain);

  // ── Fade-in ────────────────────────────────────────────
  // Si estamos en catch-up mid-clip, hay que restar lo que
  // "ya pasó" del fade-in. Si el fade-in ya terminó, saltamos.
  const remainingFadeIn = Math.max(0, (fadeIn ?? 0) - playbackOffset);
  const effectiveFadeIn = Math.min(remainingFadeIn, playedDuration);

  // ── Fade-out ───────────────────────────────────────────
  // El fade-out empieza a `originalDuration - fadeOut` desde el
  // inicio del clip. En playedDuration ese momento es:
  //   fadeOutStartInPlayed = (originalDuration - fadeOut) - playbackOffset
  const fadeOutStartInPlayed =
    (originalDuration - (fadeOut ?? 0)) - playbackOffset;

  const applyFadeOut = fadeOut > 0 && fadeOutStartInPlayed < playedDuration;
  const fadeOutStartAt = startAt + Math.max(0, fadeOutStartInPlayed);
  const effectiveFadeOut = applyFadeOut
    ? Math.min(fadeOut, playedDuration - Math.max(0, fadeOutStartInPlayed))
    : 0;

  // ── Aplicar automation ─────────────────────────────────
  // cancelScheduledValues garantiza que no queden automations
  // previas colgadas si alguien reusa el nodo (defensivo).
  param.cancelScheduledValues(startAt);

  if (effectiveFadeIn > 0) {
    // Fade-in lineal desde 0 → safeGain
    param.setValueAtTime(0, startAt);
    param.linearRampToValueAtTime(safeGain, startAt + effectiveFadeIn);
  } else {
    // Sin fade-in → mini-ramp anti-click de 0.5ms si el gain es > 0
    if (safeGain > 0) {
      param.setValueAtTime(0, startAt);
      param.linearRampToValueAtTime(safeGain, startAt + ANTI_CLICK_FADE_S);
    } else {
      param.setValueAtTime(0, startAt);
    }
  }

  if (effectiveFadeOut > 0) {
    // El valor en fadeOutStartAt debe ser safeGain (por si no hubo fadeIn)
    // setValueAtTime es idempotente si ya lo teníamos ahí.
    param.setValueAtTime(safeGain, fadeOutStartAt);
    param.linearRampToValueAtTime(0, fadeOutStartAt + effectiveFadeOut);
  }
}