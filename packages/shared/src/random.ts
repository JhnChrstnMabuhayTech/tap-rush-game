// The round's only source of randomness: a seeded mulberry32 generator. It uses
// integer operations only (Math.imul, shifts, xor), so every JS engine produces
// the same sequence, and each draw has 32 bits of precision (the kit's demo
// generator had 10,000 possible values).

/** Returns numbers in [0, 1). */
export type Random = () => number;

export const SEED_MAX = 0xffff_ffff;

/** A seed is an unsigned 32-bit integer. The server issues one per round. */
export function isSeed(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) <= SEED_MAX;
}

export function createRandom(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}
