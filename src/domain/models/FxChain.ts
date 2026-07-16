// src/domain/models/FxChain.ts

import { z } from 'zod';
import { FxPluginInstanceSchema } from './FxPluginInstance';

// ═══════════════════════════════════════════════════════════════
// 🎯 SCHEMA
// ═══════════════════════════════════════════════════════════════

/**
 * Cadena de efectos aplicada a una track (o al master bus).
 *
 * Signal path (cuando esté implementado el motor real):
 *   audioIn → plugin[0] → plugin[1] → ... → plugin[N] → audioOut
 *
 * El orden del array `plugins` ES el orden del signal path.
 *
 * NOTA: no hay bypass global de chain aquí. El bypass individual
 * por plugin sí existe (en FxPluginInstance.enabled).
 */
export const FxChainSchema = z.object({
  /** ID único de la chain (nanoid) */
  id: z.string().min(1),

  /** Track a la que pertenece esta chain (o "master" para master bus) */
  ownerId: z.string().min(1),

  /**
   * Lista ordenada de instancias de plugins.
   * El orden importa: define el signal path serial.
   */
  plugins: z.array(FxPluginInstanceSchema).default([]),
});

export type FxChain = z.infer<typeof FxChainSchema>;