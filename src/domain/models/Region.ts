import { z } from 'zod';

/**
 * Region (PLACEHOLDER)
 * --------------------
 * Región temporal seleccionable (para loops, exports, etc.).
 * Se implementará cuando se agregue el sistema de regions.
 */

export const RegionSchema = z.object({
  id: z.string().min(1),
  name: z.string().default('Region'),
  startTime: z.number().min(0),
  endTime: z.number().min(0),
  color: z.string().default('#4ECDC4'),
});

export type Region = z.infer<typeof RegionSchema>;