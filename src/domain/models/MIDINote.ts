import { z } from 'zod';

/**
 * MIDINote
 * --------
 * Nota MIDI individual dentro de un clip MIDI.
 */

export const MIDINoteSchema = z.object({
  id:            z.string().min(1),
  clipId:        z.string().min(1),
  pitch:         z.number().int().min(0).max(127),
  velocity:      z.number().int().min(0).max(127),
  startBeat:     z.number().min(0),
  durationBeats: z.number().min(0.01),
  channel:       z.number().int().min(0).max(15).default(0),
  selected:      z.boolean().default(false),
});

export type MIDINote = z.infer<typeof MIDINoteSchema>;

export function createMIDINote(input: {
  id: string;
  clipId: string;
  pitch: number;
  velocity: number;
  startBeat: number;
  durationBeats: number;
  channel?: number;
}): MIDINote {
  return MIDINoteSchema.parse(input);
}

/** Nombre de nota MIDI (ej: 60 → "C4") */
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export const midiNoteToName = (pitch: number): string => {
  const octave = Math.floor(pitch / 12) - 1;
  const name = NOTE_NAMES[pitch % 12];
  return `${name}${octave}`;
};

/** Nombre → número MIDI */
export const nameToMidiNote = (name: string): number | null => {
  const match = name.match(/^([A-G]#?)(-?\d+)$/);
  if (!match) return null;
  const noteIndex = NOTE_NAMES.indexOf(match[1]);
  if (noteIndex === -1) return null;
  const octave = parseInt(match[2], 10);
  return (octave + 1) * 12 + noteIndex;
};

/** ¿Es una nota negra (tecla negra del piano)? */
export const isBlackKey = (pitch: number): boolean =>
  [1, 3, 6, 8, 10].includes(pitch % 12);