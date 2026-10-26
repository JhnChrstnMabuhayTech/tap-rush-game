import { createRandom } from '@glowcatch/shared';
import { describe, expect, it } from 'vitest';
import {
  BEAT,
  BEATS_PER_BAR,
  BARS_PER_CHORD,
  chordAt,
  CHORDS,
  isChordTone,
  MELODY_NOTES,
  nextMelodyNote,
} from './music';

const inKey = (semitones: number) => [0, 2, 4, 7, 9].includes(((semitones % 12) + 12) % 12);

/** Plays the melody for `beats` beats from a seed; returns the notes (null = rest). */
const play = (seed: number, beats: number) => {
  const random = createRandom(seed);
  let note = 2;
  return Array.from({ length: beats }, (_, beat) => {
    const next = nextMelodyNote(note, beat, random);
    if (next !== null) note = next;
    return next;
  });
};

describe('the title music', () => {
  it('is slow and calm: 64 beats a minute', () => {
    expect(BEAT).toBeCloseTo(60 / 64, 9);
  });

  it('keeps every chord and melody note in G major pentatonic', () => {
    expect(CHORDS.flat().every(inKey)).toBe(true);
    expect(MELODY_NOTES.every(inKey)).toBe(true);
  });

  it('moves through G, E, A and D, two bars each, then starts again', () => {
    const chordBeats = BEATS_PER_BAR * BARS_PER_CHORD;
    expect([0, chordBeats, 2 * chordBeats, 3 * chordBeats, 4 * chordBeats].map(chordAt)).toEqual([
      0, 1, 2, 3, 0,
    ]);
    expect(chordAt(chordBeats - 1)).toBe(0);
  });
});

describe('nextMelodyNote', () => {
  const notes = play(11, 2000);

  it('stays in range', () => {
    for (const note of notes) {
      if (note !== null) expect(note).toBeGreaterThanOrEqual(0);
      if (note !== null) expect(note).toBeLessThan(MELODY_NOTES.length);
    }
  });

  it('rests now and then, and plays most beats', () => {
    const rests = notes.filter((note) => note === null).length / notes.length;
    expect(rests).toBeGreaterThan(0.15);
    expect(rests).toBeLessThan(0.4);
  });

  it('moves mostly by step, rarely leaps', () => {
    const played = notes.filter((note): note is number => note !== null);
    const moves = played.slice(1).map((note, i) => Math.abs(note - played[i]!));
    const leaps = moves.filter((move) => move > 2).length / moves.length;
    expect(leaps).toBeLessThan(0.1);
  });

  it('settles on a chord tone at the start of every bar', () => {
    notes.forEach((note, beat) => {
      if (beat % BEATS_PER_BAR === 0) {
        expect(note).not.toBeNull();
        expect(isChordTone(note!, chordAt(beat))).toBe(true);
      }
    });
  });

  it('wanders differently each time', () => {
    expect(play(1, 32)).not.toEqual(play(2, 32));
  });
});
