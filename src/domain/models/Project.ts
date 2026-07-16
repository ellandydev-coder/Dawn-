import { z } from 'zod';
import { TimeSignatureSchema } from './TimeSignature';

export const ProjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  author: z.string().optional(),
  contributors: z.array(z.string()).default([]),
  formatVersion: z.string().default('1.0.0'),
  version: z.number().int().positive().default(1),
  createdAt: z.number(),
  modifiedAt: z.number(),
  lastOpenedAt: z.number().optional(),
  bpm: z.number().min(1).max(999).default(120),
  timeSignature: TimeSignatureSchema.default({
    numerator: 4,
    denominator: 4,
  }),
  sampleRate: z.number().default(48000),
  durationSeconds: z.number().nonnegative().default(60),
  activeView: z.enum(['arrangement', 'mixer', 'piano-roll']).optional(),
  zoomLevel: z.number().optional(),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CURRENT_FORMAT_VERSION = '1.0.0';

export function createProject(input: {
  id: string;
  name: string;
  bpm?: number;
  sampleRate?: number;
  author?: string;
}): Project {
  const now = Date.now();
  return ProjectSchema.parse({
    id: input.id,
    name: input.name,
    author: input.author,
    bpm: input.bpm ?? 120,
    sampleRate: input.sampleRate ?? 48000,
    createdAt: now,
    modifiedAt: now,
  });
}

export function touchProject(project: Project): Project {
  return {
    ...project,
    modifiedAt: Date.now(),
    version: project.version + 1,
  };
}