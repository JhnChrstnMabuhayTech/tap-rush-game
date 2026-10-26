// Human limits for a round that replays correctly (docs/backend/trust-model.md,
// "What this doesn't stop"). A round past one of them is kept, with the reason,
// and left unranked. The limits are generous on purpose: they're for programs
// playing the real game, not for quick players.

import { TICK_MS, type CatchTiming, type Tap } from '@glowcatch/shared';

/** A catch this soon after its firefly appeared is quicker than a person reacts. */
export const FAST_CATCH_MS = 120;
/**
 * How many fast catches a round may have: a firefly can appear under a finger
 * that's already tapping, by luck, but not again and again.
 */
export const FAST_CATCHES_ALLOWED = 3;
export const FAST_CATCH_SHARE = 0.1;
/** Taps in any one second, misses included. Well past what fingers manage. */
export const MAX_TAPS_PER_SECOND = 25;

export type Implausible = 'reaction' | 'tap_rate';

export function implausibility(
  catches: readonly CatchTiming[],
  taps: readonly Tap[],
): Implausible | null {
  const fast = catches.filter((c) => (c.tick - c.spawnTick) * TICK_MS < FAST_CATCH_MS).length;
  if (fast > Math.max(FAST_CATCHES_ALLOWED, catches.length * FAST_CATCH_SHARE)) return 'reaction';
  if (busiestSecond(taps) > MAX_TAPS_PER_SECOND) return 'tap_rate';
  return null;
}

/** The most taps in any one-second window. Taps are in tick order. */
export function busiestSecond(taps: readonly Tap[]): number {
  const window = 1000 / TICK_MS;
  let most = 0;
  let start = 0;
  for (let end = 0; end < taps.length; end++) {
    while (taps[end]!.tick - taps[start]!.tick >= window) start++;
    most = Math.max(most, end - start + 1);
  }
  return most;
}
