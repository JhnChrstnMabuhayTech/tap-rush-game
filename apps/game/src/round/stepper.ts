import { TICK_MS } from '@glowcatch/shared';

/**
 * Turns real frame time into whole simulation ticks, carrying the remainder, so
 * the round runs at the same speed at 60 Hz, 120 Hz or with dropped frames.
 * After a long stall (a slow frame, a busy main thread) it runs at most
 * `maxTicks` and drops the rest: the round slows down instead of lurching ahead.
 */
export function createStepper(maxTicks = 10) {
  let carry = 0;
  return {
    /** How many ticks to step for `elapsedMs` of real time. */
    advance(elapsedMs: number): number {
      carry += Math.max(0, elapsedMs);
      const ticks = Math.floor(carry / TICK_MS);
      if (ticks > maxTicks) {
        carry = 0;
        return maxTicks;
      }
      carry -= ticks * TICK_MS;
      return ticks;
    },
    reset() {
      carry = 0;
    },
  };
}
