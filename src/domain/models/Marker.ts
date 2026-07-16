import { z } from 'zod';

/**
 * Marker (PLACEHOLDER)
 * --------------------
 * Marcador de tiempo en el timeline (cue points, secciones).
 * Se implementará cuando se agregue el sistema de marcadores.
 */

export const MarkerSchema = z.object({
  id: z.string().min(1),
  name: z.string().default('Marker'),
  time: z.number().min(0),
  color: z.string().default('#FFD700'),
  // TODO: type (cue, loop, section), notes, etc.
});

export type Marker = z.infer<typeof MarkerSchema>;