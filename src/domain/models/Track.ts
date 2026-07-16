import { z } from 'zod';
import { ALL_TRACK_TYPES } from '@domain/enums/TrackType';

export const TrackTypeSchema = z.enum(
  ALL_TRACK_TYPES as [string, ...string[]]
);
export type TrackType = z.infer<typeof TrackTypeSchema>;

export const TrackSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  type: TrackTypeSchema,
  color: z.string().default('#7A8CFF'),
  volume: z.number().min(0).max(1).default(0.8),
  pan: z.number().min(-1).max(1).default(0),
  muted: z.boolean().default(false),
  soloed: z.boolean().default(false),
  armed: z.boolean().default(false),
  height: z.number().default(80),
  clipIds: z.array(z.string()).default([]),
  effectChainId: z.string().nullable().default(null),
  outputTrackId: z.string().nullable().default(null),
});

export type Track = z.infer<typeof TrackSchema>;