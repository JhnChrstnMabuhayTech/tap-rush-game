import { describe, expect, it } from 'vitest';
import { shrink, wave } from './curves';

const samples = (n: number) => Array.from({ length: n + 1 }, (_, i) => i / n);

describe('wave', () => {
  it('hits 0, 1, 0, −1 at each quarter turn', () => {
    expect(wave(0)).toBe(0);
    expect(wave(0.25)).toBeCloseTo(1, 12);
    expect(wave(0.5)).toBeCloseTo(0, 12);
    expect(wave(0.75)).toBeCloseTo(-1, 12);
  });

  it('stays within 0.1% of sin(2πt)', () => {
    for (const t of samples(2000)) {
      expect(Math.abs(wave(t) - Math.sin(2 * Math.PI * t))).toBeLessThan(0.0011);
    }
  });

  it('repeats every turn, for negative and large inputs too', () => {
    for (const t of [0.1, 0.37, 0.8]) {
      expect(wave(t + 1)).toBeCloseTo(wave(t), 12);
      expect(wave(t - 3)).toBeCloseTo(wave(t), 12);
      expect(wave(t + 1000)).toBeCloseTo(wave(t), 9);
    }
  });
});

describe('shrink', () => {
  it('is 1 at spawn and 0 when the light is gone', () => {
    expect(shrink(1)).toBe(1);
    expect(shrink(0)).toBe(0);
    expect(shrink(1.2)).toBe(1);
    expect(shrink(-0.1)).toBe(0);
  });

  it('follows life^0.7 to within 1.5% over the first 15/16 of a life', () => {
    for (const life of samples(1000).filter((x) => x >= 1 / 16)) {
      const exact = Math.pow(life, 0.7);
      expect(Math.abs(shrink(life) - exact) / exact).toBeLessThan(0.015);
    }
  });

  it('only ever gets smaller as life runs out', () => {
    const values = samples(1000).map(shrink);
    values.slice(1).forEach((value, i) => expect(value).toBeGreaterThan(values[i]!));
  });
});
