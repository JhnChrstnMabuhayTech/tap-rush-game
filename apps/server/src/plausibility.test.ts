import type { CatchTiming, Tap } from '@glowcatch/shared';
import { describe, expect, it } from 'vitest';
import { busiestSecond, implausibility, MAX_TAPS_PER_SECOND } from './plausibility';

/** `fast` catches 50 ms after the firefly appeared, then `slow` ones 400 ms after. */
function catches(fast: number, slow: number): CatchTiming[] {
  const at = (i: number, delayTicks: number) => ({
    kind: 'normal' as const,
    spawnTick: i * 100,
    tick: i * 100 + delayTicks,
  });
  return [
    ...Array.from({ length: fast }, (_, i) => at(i, 5)),
    ...Array.from({ length: slow }, (_, i) => at(fast + i, 40)),
  ];
}

const tapsEvery = (ticks: number, count: number): Tap[] =>
  Array.from({ length: count }, (_, i) => ({ tick: i * ticks, x: 10, y: 10 }));

describe('implausibility', () => {
  it('passes a round of human catches', () => {
    expect(implausibility(catches(0, 60), tapsEvery(30, 60))).toBeNull();
  });

  it('allows a few lucky fast catches, or a tenth of a big round', () => {
    expect(implausibility(catches(3, 7), [])).toBeNull();
    expect(implausibility(catches(5, 45), [])).toBeNull();
  });

  it('flags a round where catches keep beating reaction time', () => {
    expect(implausibility(catches(4, 6), [])).toBe('reaction');
    expect(implausibility(catches(6, 44), [])).toBe('reaction');
    expect(implausibility(catches(60, 0), [])).toBe('reaction');
  });

  it('flags more than 25 taps in a second', () => {
    expect(implausibility([], tapsEvery(4, MAX_TAPS_PER_SECOND))).toBeNull();
    expect(implausibility([], tapsEvery(3, MAX_TAPS_PER_SECOND + 1))).toBe('tap_rate');
  });
});

describe('busiestSecond', () => {
  it('counts the most taps in any 100-tick window', () => {
    expect(busiestSecond([])).toBe(0);
    expect(busiestSecond(tapsEvery(10, 30))).toBe(10);
    expect(busiestSecond([...tapsEvery(50, 4), { tick: 151, x: 0, y: 0 }])).toBe(3);
  });

  it('counts multi-touch taps on the same tick', () => {
    const together = Array.from({ length: 5 }, () => ({ tick: 40, x: 0, y: 0 }));
    expect(busiestSecond(together)).toBe(5);
  });
});
