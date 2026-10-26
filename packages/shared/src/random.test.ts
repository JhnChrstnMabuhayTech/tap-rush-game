import { describe, expect, it } from 'vitest';
import { createRandom, isSeed, SEED_MAX } from './random';

const draw = (seed: number, n: number) => {
  const random = createRandom(seed);
  return Array.from({ length: n }, random);
};

describe('createRandom', () => {
  it('gives the same sequence for the same seed', () => {
    expect(draw(42, 1000)).toEqual(draw(42, 1000));
  });

  it('gives different sequences for different seeds', () => {
    expect(draw(42, 10)).not.toEqual(draw(43, 10));
  });

  // Stored rounds are replayed from their seed, so the sequence must never change.
  it('is exactly mulberry32', () => {
    expect(draw(1, 3)).toEqual([0.6270739405881613, 0.002735721180215478, 0.5274470399599522]);
  });

  it('stays in [0, 1)', () => {
    for (const x of draw(7, 100_000)) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('has far more than the 10,000 values the kit demo produced', () => {
    expect(new Set(draw(7, 100_000)).size).toBeGreaterThan(99_000);
  });

  it('is roughly uniform', () => {
    const values = draw(2026, 100_000);
    const mean = values.reduce((sum, x) => sum + x, 0) / values.length;
    expect(mean).toBeCloseTo(0.5, 2);
    const low = values.filter((x) => x < 0.1).length / values.length;
    expect(low).toBeCloseTo(0.1, 2);
  });

  it('treats every seed as 32 bits', () => {
    expect(draw(SEED_MAX + 1, 5)).toEqual(draw(0, 5));
  });
});

describe('isSeed', () => {
  it('accepts unsigned 32-bit integers only', () => {
    expect([0, 1, SEED_MAX].every(isSeed)).toBe(true);
    expect([-1, SEED_MAX + 1, 1.5, NaN, '7', null].some(isSeed)).toBe(false);
  });
});
