import { z } from 'zod';

export const SendSchema = z.object({
  id: z.string().min(1),
  sourceTrackId: z.string().min(1),
  destinationBusId: z.string().min(1),
  amount: z.number().min(0).max(1).default(0),
  pan: z.number().min(-1).max(1).default(0),
  preFader: z.boolean().default(true),
  muted: z.boolean().default(false),
});

export type Send = z.infer<typeof SendSchema>;