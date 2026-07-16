import { z } from 'zod';
import { ALL_AUTOMATION_MODES } from '@domain/enums/AutomationMode';

export const AutomationPointSchema = z.object({
  id: z.string(),
  time: z.number().min(0),
  value: z.number(),
  curve: z.enum(['linear', 'exponential', 'hold']).default('linear'),
});
export type AutomationPoint = z.infer<typeof AutomationPointSchema>;

export const AutomationLaneSchema = z.object({
  id: z.string(),
  trackId: z.string(),
  targetType: z.enum(['track', 'effect']),
  targetId: z.string(),
  parameter: z.string(),
  mode: z.enum(ALL_AUTOMATION_MODES as [string, ...string[]]).default('read'),
  enabled: z.boolean().default(true),
  minValue: z.number(),
  maxValue: z.number(),
  points: z.array(AutomationPointSchema).default([]),
});

export type AutomationLane = z.infer<typeof AutomationLaneSchema>;