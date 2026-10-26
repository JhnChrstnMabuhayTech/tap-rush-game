// Calm music for the title: generated as it plays, so it never repeats on a
// loop. Open-fifth chords move slowly (G, E, A, D, two bars each at 64 bpm), a
// soft music-box melody wanders mostly by step and leans on the chord, and a
// low note marks each bar. Every note is in G major pentatonic, so a firefly
// caught on the title chimes in key with it.

/** Seconds per beat at 64 bpm. */
export const BEAT = 60 / 64;
export const BEATS_PER_BAR = 4;
export const BARS_PER_CHORD = 2;

/** Each chord as semitones above G4: a low root, its fifth, and the root an octave up. */
export const CHORDS: readonly (readonly [number, number, number])[] = [
  [-24, -17, -12], // G
  [-27, -20, -15], // E
  [-22, -15, -10], // A
  [-29, -22, -17], // D
];

/** The melody's notes: G major pentatonic from G4 to G5, in semitones above G4. */
export const MELODY_NOTES = [0, 2, 4, 7, 9, 12] as const;

/** The chord sounding on a given beat (counting from 0). */
export function chordAt(beat: number): number {
  return Math.floor(beat / (BEATS_PER_BAR * BARS_PER_CHORD)) % CHORDS.length;
}

/** True if the melody note (an index into MELODY_NOTES) belongs to the chord. */
export function isChordTone(note: number, chord: number): boolean {
  const pitch = (((MELODY_NOTES[note]! - CHORDS[chord]![0]) % 12) + 12) % 12;
  return pitch === 0 || pitch === 7;
}

/**
 * What the melody plays on a beat: null to rest, or the next note, as an index
 * into MELODY_NOTES. It moves mostly by step, rarely leaps, rests about a third
 * of the time, and on the first beat of a bar prefers a note of the chord, so
 * it settles rather than wanders. `random` returns [0, 1).
 */
export function nextMelodyNote(
  previous: number,
  beat: number,
  random: () => number,
): number | null {
  const downbeat = beat % BEATS_PER_BAR === 0;
  if (!downbeat && random() < 0.35) return null;
  const roll = random();
  const move = roll < 0.25 ? 0 : roll < 0.85 ? (random() < 0.5 ? -1 : 1) : random() < 0.5 ? -2 : 2;
  let note = Math.max(0, Math.min(MELODY_NOTES.length - 1, previous + move));
  if (downbeat && !isChordTone(note, chordAt(beat))) {
    const chord = chordAt(beat);
    const nearest = MELODY_NOTES.map((_, i) => i)
      .filter((i) => isChordTone(i, chord))
      .sort((a, b) => Math.abs(a - note) - Math.abs(b - note))[0];
    if (nearest !== undefined) note = nearest;
  }
  return note;
}
