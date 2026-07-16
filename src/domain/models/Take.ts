import { z } from 'zod';

/**
 * Take (PLACEHOLDER)
 * ------------------
 * Toma individual de una grabación (para multi-take/comping).
 * Se implementará cuando se agregue multi-take recording.
 */

export const TakeSchema = z.object({
  id: z.string().min(1),
  trackId: z.string().min(1),
  clipId: z.string().min(1),
  takeNumber: z.number().int().min(1).default(1),
  name: z.string().optional(),
  recordedAt: z.number(),
  // TODO: rating, notes, active, etc.
});

export type Take = z.infer<typeof TakeSchema>;