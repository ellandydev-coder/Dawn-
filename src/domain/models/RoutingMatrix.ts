import { z } from 'zod';

/**
 * RoutingMatrix (PLACEHOLDER)
 * ---------------------------
 * Matriz de routing avanzado entre tracks, buses y salidas.
 * Se implementará cuando se agregue el routing flexible.
 */

export const RoutingConnectionSchema = z.object({
  fromId: z.string().min(1),
  toId: z.string().min(1),
  gain: z.number().default(1),
  enabled: z.boolean().default(true),
});

export const RoutingMatrixSchema = z.object({
  connections: z.array(RoutingConnectionSchema).default([]),
});

export type RoutingConnection = z.infer<typeof RoutingConnectionSchema>;
export type RoutingMatrix = z.infer<typeof RoutingMatrixSchema>;