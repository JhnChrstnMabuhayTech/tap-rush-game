// Which notes play when, as plain numbers, so they can be tested without a
// sound card. Everything sits in G major pentatonic: the catch melodies, the
// countdown and the ambient pad that drones under them, so no two sounds can
// clash.

const G4 = 391.995;

/** Frequency in Hz of the note `semitones` above G4. */
export function noteAbove(semitones: number): number {
  return G4 * Math.pow(2, semitones / 12);
}

/**
 * Six short tunes for the catch chimes, in semitones above G4 (D4 to G5). Each
 * catch in a row plays the next note; a broken streak starts a different tune.
 * They're original, written to loop: the last note leads back to the first.
 */
export const MELODIES: readonly (readonly number[])[] = [
  [0, 2, 4, 7, 4, 2, 0, -3, 0, 2, 4, 0], // Dusk
  [7, 4, 7, 9, 7, 4, 2, 4, 7, 4, 2, 0], // Fireflies
  [4, 4, 7, 9, 12, 9, 7, 4, 2, 4, 2, 0], // Meadow
  [9, 7, 4, 7, 2, 4, 0, 2, -3, 0, 2, 0], // Lullaby
  [-5, 0, 2, 4, 2, 0, 4, 7, 9, 7, 4, 7], // Lanterns
  [12, 9, 7, 9, 7, 4, 2, 4, 7, 9, 12, 7], // Stars
];

/** A tune for a new streak: any but the one just played. `random` returns [0, 1). */
export function nextMelody(previous: number, random: () => number): number {
  const pick = Math.floor(random() * (MELODIES.length - 1));
  return previous >= 0 && pick >= previous ? pick + 1 : pick;
}

/**
 * The note for the `streak`-th catch in a row, in semitones above G4. The tune
 * loops, and the streak still builds: from ×2 it plays an octave higher.
 */
export function melodyStep(melody: number, streak: number, combo: number): number {
  const tune = MELODIES[melody]!;
  return tune[(Math.max(streak, 1) - 1) % tune.length]! + (combo >= 2 ? 12 : 0);
}

/** G major pentatonic within one octave, in semitones above G. */
const PENTATONIC = [0, 2, 4, 7, 9] as const;

/**
 * The note `steps` places up G major pentatonic from `semitones` (which must be
 * in the scale), for figures that have to stay in key: a fixed interval like a
 * fifth turns B into F#, which isn't.
 */
export function pentatonicUp(semitones: number, steps: number): number {
  const octave = Math.floor(semitones / 12);
  const degree = PENTATONIC.indexOf((semitones - octave * 12) as (typeof PENTATONIC)[number]);
  if (degree < 0) throw new RangeError(`${semitones} is not in G major pentatonic`);
  const target = degree + steps;
  return (
    (octave + Math.floor(target / PENTATONIC.length)) * 12 + PENTATONIC[target % PENTATONIC.length]!
  );
}

/** A new multiplier rings out above the tune: D and G for ×2, G and B for ×3. */
export function comboUpNotes(combo: number): [number, number] {
  return combo >= 3 ? [noteAbove(24), noteAbove(28)] : [noteAbove(19), noteAbove(24)];
}

/** The ambient pad: a low G, D and B, quiet enough to sit under everything. */
export const PAD_NOTES = [noteAbove(-24), noteAbove(-17), noteAbove(-8)] as const;

/** The countdown climbs D, E, G (semitones above G4) into "Go!". */
const COUNTDOWN_PIPS = { 3: 7, 2: 9, 1: 12 } as const;

/** The pip for 3, 2 or 1. */
export function countdownPip(step: 3 | 2 | 1): number {
  return noteAbove(COUNTDOWN_PIPS[step]);
}

/** "Go!" strums G, B, D and G an octave up from the last pip. */
export const GO_CHORD = [12, 16, 19, 24].map(noteAbove);
