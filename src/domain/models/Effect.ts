import { z } from 'zod';
import { ALL_EFFECT_TYPES } from '@domain/enums/EffectType';

export const EffectSchema = z.object({
  id: z.string().min(1),
  trackId: z.string().min(1),
  type: z.string().refine(
    (val) => ALL_EFFECT_TYPES.includes(val as never),
    { message: 'Invalid effect type' }
  ),
  name: z.string().min(1),
  bypassed: z.boolean().default(false),
  parameters: z.record(z.string(), z.number()).default({}),
  position: z.number().int().nonnegative().default(0),
  presetName: z.string().optional(),
});

export type Effect = z.infer<typeof EffectSchema>;

export function createEffect(input: {
  id: string;
  trackId: string;
  type: string;
  name?: string;
  parameters?: Record<string, number>;
  position?: number;
}): Effect {
  return {
    id: input.id,
    trackId: input.trackId,
    type: input.type,
    name: input.name ?? input.type,
    bypassed: false,
    parameters: input.parameters ?? {},
    position: input.position ?? 0,
  };
}