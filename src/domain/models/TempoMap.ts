import { z } from 'zod';
import { TempoSchema } from './Tempo';

/**
 * TempoMap (PLACEHOLDER)
 * ----------------------
 * Mapa de cambios de tempo a lo largo del proyecto.
 * Se implementará cuando se agreguen cambios de tempo.
 */

export const TempoMapSchema = z.object({
  tempos: z.array(TempoSchema).default([]),
});

export type TempoMap = z.infer<typeof TempoMapSchema>;