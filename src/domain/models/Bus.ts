import { z } from 'zod';

/**
 * Bus (PLACEHOLDER)
 * -----------------
 * Bus de mezcla para agrupar tracks (drum bus, vocal bus, etc.).
 * Se implementará cuando se agregue el sistema de buses avanzado.
 */

export const BusSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  color: z.string().default('#888888'),
  volume: z.number().min(0).max(1).default(0.8),
  muted: z.boolean().default(false),
  // TODO: routing, sends, inserts, etc.
});

export type Bus = z.infer<typeof BusSchema>;