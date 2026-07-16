import { z } from 'zod';

/**
 * Tempo (PLACEHOLDER)
 * -------------------
 * Punto de tempo (BPM) en un momento específico del proyecto.
 * Usado por TempoMap para cambios de tempo.
 */

export const TempoSchema = z.object({
  id: z.string().min(1),
  time: z.number().min(0),
  bpm: z.number().min(20).max(999),
  curve: z.enum(['constant', 'linear']).default('constant'),
});

export type Tempo = z.infer<typeof TempoSchema>;