import { describe, expect, it } from 'vitest';
import { createRandom } from '@glowcatch/shared';
import {
  comboUpNotes,
  countdownPip,
  GO_CHORD,
  melodyStep,
  MELODIES,
  nextMelody,
  noteAbove,
  PAD_NOTES,
  pentatonicUp,
} from './notes';

const inKey = (semitones: number) => [0, 2, 4, 7, 9].includes(((semitones % 12) + 12) % 12);

describe('noteAbove', () => {
  it('is G4 at 0 and doubles every octave', () => {
    expect(noteAbove(0)).toBeCloseTo(392, 0);
    expect(noteAbove(12)).toBeCloseTo(784, 0);
    expect(noteAbove(2)).toBeCloseTo(440, 0); // A4
  });
});

describe('MELODIES', () => {
  it('offers several tunes, every note in G major pentatonic', () => {
    expect(MELODIES.length).toBeGreaterThanOrEqual(5);
    for (const tune of MELODIES) {
      expect(tune.length).toBeGreaterThanOrEqual(8);
      expect(tune.every(inKey)).toBe(true);
    }
  });

  it('are all different', () => {
    expect(new Set(MELODIES.map((tune) => tune.join(','))).size).toBe(MELODIES.length);
  });
});

describe('nextMelody', () => {
  it('never plays the same tune twice in a row', () => {
    const random = createRandom(9);
    let melody = -1;
    for (let i = 0; i < 500; i++) {
      const next = nextMelody(melody, random);
      expect(next).not.toBe(melody);
      expect(next).toBeGreaterThanOrEqual(0);
      expect(next).toBeLessThan(MELODIES.length);
      melody = next;
    }
  });

  it('reaches every tune', () => {
    const random = createRandom(4);
    const seen = new Set<number>();
    let melody = -1;
    for (let i = 0; i < 200; i++) seen.add((melody = nextMelody(melody, random)));
    expect(seen.size).toBe(MELODIES.length);
  });
});

describe('melodyStep', () => {
  it('plays the tune one note per catch, and loops', () => {
    const tune = MELODIES[2]!;
    expect([1, 2, 3].map((streak) => melodyStep(2, streak, 1))).toEqual(tune.slice(0, 3));
    expect(melodyStep(2, tune.length + 1, 1)).toBe(tune[0]);
  });

  it('lifts the tune an octave from ×2, so the streak still builds', () => {
    expect(melodyStep(0, 5, 2)).toBe(melodyStep(0, 5, 1) + 12);
    expect(melodyStep(0, 11, 3)).toBe(melodyStep(0, 11, 1) + 12);
  });
});

describe('pentatonicUp', () => {
  it('steps along the scale and across octaves', () => {
    expect(pentatonicUp(0, 1)).toBe(2); // G → A
    expect(pentatonicUp(4, 1)).toBe(7); // B → D, not C
    expect(pentatonicUp(9, 1)).toBe(12); // E → G above
    expect(pentatonicUp(-3, 2)).toBe(2); // E below → A
  });

  it('keeps every figure built on a tune in key', () => {
    for (const tune of MELODIES) {
      for (const step of tune) {
        for (const up of [1, 2, 3, 4]) expect(inKey(pentatonicUp(step, up))).toBe(true);
      }
    }
  });

  it('refuses a note outside the scale', () => {
    expect(() => pentatonicUp(5, 1)).toThrow(RangeError);
  });
});

describe('comboUpNotes', () => {
  it('rings out in key above the tune: D-G for ×2, G-B for ×3', () => {
    expect(comboUpNotes(2)).toEqual([noteAbove(19), noteAbove(24)]);
    expect(comboUpNotes(3)).toEqual([noteAbove(24), noteAbove(28)]);
  });
});

describe('PAD_NOTES', () => {
  it('sits well below the tunes', () => {
    const lowest = Math.min(...MELODIES.flat());
    expect(Math.max(...PAD_NOTES)).toBeLessThan(noteAbove(lowest));
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
