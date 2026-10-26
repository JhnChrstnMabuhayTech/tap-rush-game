/**
 * A CSS duration in milliseconds: "800ms" and ".8s" are both 800. Duration
 * tokens are read at runtime, and a stylesheet may write them either way;
 * parseFloat alone would read ".8s" as 0.8 ms. Returns `fallback` for anything
 * else.
 */
export function durationMs(value: string, fallback: number): number {
  const match = /^\s*(-?\d*\.?\d+)\s*(ms|s)\s*$/i.exec(value);
  if (!match) return fallback;
  const amount = Number(match[1]);
  return match[2]!.toLowerCase() === 's' ? amount * 1000 : amount;
}
