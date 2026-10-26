// The title field's decisions, as plain functions so they can be tested
// without a canvas. Nothing here is scored: the title is a toy, not a round.

import type { BonusKind } from '@glowcatch/shared';

/** The sky between the top inset and the game's name, where title fireflies live. */
export interface Area {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Where a title firefly of radius `r` may appear: clear of the sides, below
 * the top inset (the Sound toggle sits there), and above the name. If the
 * screen is too short for that, it falls back to the top half.
 */
export function spawnArea(
  width: number,
  height: number,
  nameTop: number,
  r: number,
  topInset: number,
): Area {
  const top = topInset + 64 + r;
  const bottom = Math.max(top + r, nameTop - r - 12);
  if (bottom - top < 2 * r)
    return { left: r * 2, right: width - r * 2, top: r * 2, bottom: height / 2 };
  return { left: r * 2, right: width - r * 2, top, bottom };
}

/** Visitors take turns, so a player who lingers sees every bonus. */
export function nextVisitor(previous: BonusKind | null): BonusKind {
  return previous === 'lantern' ? 'frost' : previous === 'frost' ? 'swarm' : 'lantern';
}

/** What catching each visitor teaches, from the How to play copy (states.md). */
export const VISITOR_COPY: Record<BonusKind, string> = {
  lantern: 'Lantern — +5 points',
  frost: 'Frost — Stops the clock for 3s',
  swarm: 'Swarm — Six quick fireflies',
};

export interface TitleFirefly {
  x: number;
  y: number;
  /** Radius at full light. */
  r: number;
  /** 1 → 0 */
  life: number;
}

/** A forgiving hit test (the title is for fun): visible radius plus a wide slop. */
export function hitTitleFirefly<T extends TitleFirefly>(
  fireflies: readonly T[],
  x: number,
  y: number,
  slop = 16,
): T | undefined {
  let target: T | undefined;
  let best = Infinity;
  for (const f of fireflies) {
    const reach = f.r * Math.pow(Math.max(0, f.life), 0.7) + slop;
    const d = (f.x - x) ** 2 + (f.y - y) ** 2;
    if (d <= reach * reach && d < best) {
      best = d;
      target = f;
    }
  }
  return target;
}
