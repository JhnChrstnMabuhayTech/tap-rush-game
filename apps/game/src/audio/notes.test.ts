import { describe, expect, it } from 'vitest';
import { chimeFor, comboUpNotes, countdownPip, GO_CHORD, noteAbove, PAD_NOTES } from './notes';

describe('noteAbove', () => {
  it('is G4 at 0 and doubles every octave', () => {
    expect(noteAbove(0)).toBeCloseTo(392, 0);
    expect(noteAbove(12)).toBeCloseTo(784, 0);
    expect(noteAbove(2)).toBeCloseTo(440, 0); // A4
  });
});

describe('chimeFor', () => {
  it('climbs one step with each catch in a row', () => {
    const notes = [1, 2, 3, 4, 5, 6].map(chimeFor);
    notes.slice(1).forEach((note, i) => expect(note).toBeGreaterThan(notes[i]!));
    expect(chimeFor(1)).toBeCloseTo(392, 0);
  });

  it('stays on the top note from the 10th catch', () => {
    expect(chimeFor(10)).toBe(chimeFor(25));
    expect(chimeFor(10)).toBeCloseTo(noteAbove(21), 6);
  });

  it('starts at the bottom for a streak of 0 or less', () => {
    expect(chimeFor(0)).toBe(chimeFor(1));
  });
});

describe('comboUpNotes', () => {
  it('rings the octave and the fifth above the chime', () => {
    const [octave, fifth] = comboUpNotes(5);
    expect(octave).toBeCloseTo(chimeFor(5) * 2, 6);
    expect(fifth / octave).toBeCloseTo(1.5, 6);
  });
});

describe('PAD_NOTES', () => {
  it('sits well below the chimes', () => {
    expect(Math.max(...PAD_NOTES)).toBeLessThan(chimeFor(1) / 1.5);
  });
});

describe('the countdown', () => {
  it('climbs from 3 to 1', () => {
    expect(countdownPip(2)).toBeGreaterThan(countdownPip(3));
    expect(countdownPip(1)).toBeGreaterThan(countdownPip(2));
  });

  it('lands on G for "Go!", where the last pip left off', () => {
    expect(GO_CHORD[0]).toBeCloseTo(countdownPip(1), 6);
    expect(GO_CHORD).toHaveLength(4);
    expect(GO_CHORD.at(-1)! / GO_CHORD[0]!).toBeCloseTo(2, 6);
  });
});
