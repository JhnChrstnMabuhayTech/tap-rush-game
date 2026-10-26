// Smooth curves for game decisions, built from + − × ÷ and exact Math helpers
// only. Math.sin and Math.pow may round differently from one JS engine to
// another, and the server must replay a round to the bit, so where a decision
// depends on a curve (where a firefly is, how big it is) the simulation uses
// these instead.

/**
 * A sine-shaped wave measured in turns: wave(0) = 0, wave(0.25) = 1,
 * wave(0.75) = −1. Within 0.1% of sin(2πt): a parabola per half-turn, refined.
 */
export function wave(turns: number): number {
  const u = turns - Math.floor(turns + 0.5); // −0.5 ≤ u < 0.5
  const y = 8 * u - 16 * u * Math.abs(u);
  return y + 0.225 * (y * Math.abs(y) - y);
}

// life^0.7 at life = 0, 1/16, 2/16, …, 1
const SHRINK = [
  0, 0.143587, 0.233258, 0.309814, 0.378929, 0.442991, 0.503294, 0.560641, 0.615572, 0.668476,
  0.719641, 0.769291, 0.817604, 0.864722, 0.910764, 0.955828, 1,
] as const;
const STEPS = SHRINK.length - 1;

/**
 * A firefly's visible radius as a share of its start radius, for `life` from
 * 1 (just spawned) to 0 (gone): the design's life^0.7, sampled and linearly
 * interpolated. It stays catchable for most of its life, then winks out.
 */
export function shrink(life: number): number {
  if (life <= 0) return 0;
  if (life >= 1) return 1;
  const x = life * STEPS;
  const i = Math.floor(x);
  return SHRINK[i]! + (SHRINK[i + 1]! - SHRINK[i]!) * (x - i);
}
