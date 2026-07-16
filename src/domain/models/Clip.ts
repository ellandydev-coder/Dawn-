import { z } from 'zod';
import { ALL_CLIP_TYPES } from '@domain/enums/ClipType';

export const ClipTypeSchema = z.enum(
  ALL_CLIP_TYPES as [string, ...string[]]
);
export type ClipType = z.infer<typeof ClipTypeSchema>;

export const ClipSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  type: ClipTypeSchema,
  name: z.string(),
  startTime: z.number().min(0),
  duration: z.number().min(0),
  offset: z.number().default(0),
  color: z.string().optional(),
  assetId: z.string().nullable().default(null),
  gain: z.number().default(1),
  fadeIn: z.number().default(0),
  fadeOut: z.number().default(0),
  noteIds: z.array(z.string()).default([]),
});

export type Clip = z.infer<typeof ClipSchema>;