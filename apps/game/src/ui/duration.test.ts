import { describe, expect, it } from 'vitest';
import { durationMs } from './duration';

describe('durationMs', () => {
  it('reads milliseconds', () => {
    expect(durationMs('800ms', 0)).toBe(800);
    expect(durationMs(' 90ms ', 0)).toBe(90);
  });

  it('reads seconds, as a minifier writes them', () => {
    expect(durationMs('.8s', 0)).toBe(800);
    expect(durationMs('1.6s', 0)).toBe(1600);
    expect(durationMs('3s', 0)).toBe(3000);
  });

  it('falls back on anything it cannot read', () => {
    expect(durationMs('', 800)).toBe(800);
    expect(durationMs('soon', 800)).toBe(800);
    expect(durationMs('800', 700)).toBe(700);
  });
});
