import { z } from 'zod';
import { MIDINoteSchema } from './MIDINote';

/**
 * MIDIClip
 * --------
 * Datos completos de un clip MIDI con notas embebidas.
 *
 * NOTA: En el estado normalizado (Redux), las notas se
 * guardan por separado. Este modelo es para serialización/carga.
 */

export const MIDIClipSchema = z.object({
  id:              z.string().min(1),
  trackId:         z.string().min(1),
  name:            z.string().min(1),
  color:           z.string().optional(),
  startSeconds:    z.number().min(0),
  durationSeconds: z.number().positive(),
  notes:           z.array(MIDINoteSchema).default([]),
  loopEnabled:     z.boolean().default(false),
  loopStartSeconds: z.number().min(0).optional(),
  loopEndSeconds:   z.number().min(0).optional(),
});

export type MIDIClip = z.infer<typeof MIDIClipSchema>;

export function createMIDIClip(input: {
  id: string;
  trackId: string;
  name: string;
  startSeconds: number;
  durationSeconds: number;
  color?: string;
}): MIDIClip {
  return MIDIClipSchema.parse(input);
}

/** Duración en beats dado un BPM */
export const midiClipDurationBeats = (clip: MIDIClip, bpm: number): number =>
  clip.durationSeconds * (bpm / 60);

/** Nota más grave del clip */
export const lowestNote = (clip: MIDIClip): number =>
  clip.notes.length === 0
    ? 0
    : Math.min(...clip.notes.map((n) => n.pitch));

/** Nota más aguda del clip */
export const highestNote = (clip: MIDIClip): number =>
  clip.notes.length === 0
    ? 127
    : Math.max(...clip.notes.map((n) => n.pitch));