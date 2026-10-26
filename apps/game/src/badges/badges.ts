// Achievement badges: one for each score a player reaches in a single round.
// Badges are read from the best score, not stored on their own, so the two can
// never disagree; when the best moves to Facebook's player data or the server,
// the badges follow it.
//
// The thresholds come from simulated rounds (decision D15): a casual player's
// median is about 56, an average player's about 145, a strong player's about
// 243, and perfect play about 252-311.

import type { FireflyKind } from '@glowcatch/shared';

export interface Badge {
  id: string;
  /** Sentence case, under 14 characters (brand.md, voice). */
  name: string;
  /** Reach this score in one round to earn it. */
  score: number;
  /** The firefly drawn on its medallion. */
  kind: FireflyKind;
}

export const BADGES: readonly Badge[] = [
  { id: 'first-light', name: 'First light', score: 10, kind: 'normal' },
  { id: 'spark-catcher', name: 'Spark catcher', score: 40, kind: 'normal' },
  { id: 'lantern-keeper', name: 'Lantern keeper', score: 75, kind: 'lantern' },
  { id: 'night-watcher', name: 'Night watcher', score: 120, kind: 'frost' },
  { id: 'meadow-glow', name: 'Meadow glow', score: 170, kind: 'swarm' },
  { id: 'moon-catcher', name: 'Moon catcher', score: 230, kind: 'frost' },
  { id: 'starfield', name: 'Starfield', score: 280, kind: 'lantern' },
];

/** Every badge a best score has earned. */
export function earnedBadges(best: number): Badge[] {
  return BADGES.filter((badge) => badge.score <= best);
}

/** The badges a round just unlocked: crossed between the old best and this score. */
export function unlockedBadges(previousBest: number, score: number): Badge[] {
  return BADGES.filter((badge) => badge.score > previousBest && badge.score <= score);
}

/** The next badge to aim for, or undefined when every one is earned. */
export function nextBadge(best: number): Badge | undefined {
  return BADGES.find((badge) => badge.score > best);
}

/** 0 → 1: how far the best has come from the last badge earned toward the next. */
export function progressToNext(best: number): number {
  const next = nextBadge(best);
  if (!next) return 1;
  const from = earnedBadges(best).at(-1)?.score ?? 0;
  return Math.max(0, Math.min(1, (best - from) / (next.score - from)));
}
