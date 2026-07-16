import { z } from 'zod';
import { ALL_PAN_LAWS } from '@domain/enums/PanLaw';

export const MixerChannelSchema = z.object({
  trackId: z.string().min(1),
  insertIds: z.array(z.string()).default([]),
  insertsBypassed: z.boolean().default(false),
  sendIds: z.array(z.string()).default([]),
  outputBusId: z.string().default('master'),
  meterPreFader: z.boolean().default(false),
  peakHoldSeconds: z.number().default(2),
  showAutomation: z.boolean().default(false),
});

export const MixerStateSchema = z.object({
  masterVolume: z.number().min(0).max(1).default(0.8),
  masterMuted: z.boolean().default(false),
  masterLimiterEnabled: z.boolean().default(false),
  masterHeadroom: z.number().default(0),
  soloIsExclusive: z.boolean().default(true),
  panLaw: z.string().refine(
    (val) => ALL_PAN_LAWS.includes(val as never),
    { message: 'Invalid pan law' }
  ).default('-3dB'),
  channelWidth: z.number().int().positive().default(80),
  showSends: z.boolean().default(true),
  showInserts: z.boolean().default(true),
});

export type MixerChannel = z.infer<typeof MixerChannelSchema>;
export type MixerState = z.infer<typeof MixerStateSchema>;

export function createMixerChannel(trackId: string): MixerChannel {
  return MixerChannelSchema.parse({ trackId });
}

export function createDefaultMixerState(): MixerState {
  return MixerStateSchema.parse({});
}