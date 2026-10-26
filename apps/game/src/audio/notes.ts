// Which notes play when, as plain numbers, so they can be tested without a
// sound card. Everything sits in G major pentatonic: the catch chimes climb it
// with the streak (design: gameplay.md), and the ambient pad drones under it,
// so no two sounds can clash.

/** Semitones above G4 for the chime ladder: two octaves of G major pentatonic. */
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21] as const;
const G4 = 391.995;

/** Frequency in Hz of the note `semitones` above G4. */
export function noteAbove(semitones: number): number {
  return G4 * Math.pow(2, semitones / 12);
}

/** The catch chime climbs one step per catch in a row, and stays on top from the 10th. */
export function chimeFor(streak: number): number {
  const step = Math.min(Math.max(streak, 1), LADDER.length) - 1;
  return noteAbove(LADDER[step]!);
}

/** A new multiplier rings brighter: the chime's octave and the fifth above it. */
export function comboUpNotes(streak: number): [number, number] {
  const base = chimeFor(streak);
  return [base * 2, base * 3];
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
