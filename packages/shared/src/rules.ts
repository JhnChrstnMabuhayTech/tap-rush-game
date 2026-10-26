// The round's rules, ported from the Glowcatch UI kit (Glowcatch.CURVE, BONUSES,
// comboFor, pointsFor) so the game and the server read the same numbers.
// The design docs are docs/design/gameplay.md; change the numbers here, never in
// an app. A change that would replay an existing round differently bumps
// RULES_VERSION in index.ts.

export type FireflyKind = 'normal' | 'lantern' | 'frost' | 'swarm';
export type BonusKind = Exclude<FireflyKind, 'normal'>;
/** What can be on the field: the four kinds, plus the quick fireflies a Swarm releases. */
export type SpawnKind = FireflyKind | 'swarm-mote';
export type Combo = 1 | 2 | 3;
export type PhaseIndex = 0 | 1 | 2;

/** Seconds of play in a round, not counting frozen time. */
export const ROUND_SECONDS = 30;

/** The score at which pace reaches 1 on its own. */
export const PACE_SCORE = 90;

/** No bonus appears before this many seconds of play. */
export const FIRST_BONUS_SECONDS = 5;

export const PHASES = [
  { id: 'dusk', name: 'Dusk', from: 0 },
  { id: 'night', name: 'Night falls', from: 1 / 3 },
  { id: 'midnight', name: 'Midnight', from: 2 / 3 },
] as const;

export type PhaseId = (typeof PHASES)[number]['id'];

/** Values at pace 0, ⅓, ⅔ and 1; linear in between. */
export const CURVE = {
  /** ms between normal spawns; the opening is deliberately gentle. */
  spawnEvery: [950, 620, 460, 340],
  /** Normal fireflies alive at once. */
  maxAlive: [2, 3, 5, 6],
  /** ms a normal firefly lives. */
  life: [1900, 1450, 1150, 850],
  /** × the start diameter. */
  sizeScale: [1.08, 0.95, 0.82, 0.7],
  /** Logical px of wander. */
  drift: [4, 10, 18, 24],
  /** ms between bonuses. */
  bonusEvery: [8000, 6500, 5000, 5000],
  /** ms without a catch before the streak is lost. */
  streakWindow: [3000, 3000, 2600, 2200],
} as const satisfies Record<string, readonly [number, number, number, number]>;

export const BONUSES = {
  lantern: { name: 'Lantern', effect: '+5', points: 5, life: 1200, sizeScale: 1.25, weight: 40 },
  frost: {
    name: 'Frost',
    effect: 'Stops the clock for 3s',
    freezeMs: 3000,
    life: 1300,
    sizeScale: 1,
    weight: 35,
    maxPerRound: 2,
  },
  swarm: {
    name: 'Swarm',
    effect: 'Six quick fireflies',
    count: 6,
    windowMs: 2500,
    life: 1300,
    sizeScale: 1,
    moteLife: 800,
    moteScale: 0.6,
    weight: 25,
  },
} as const;

/** Bonuses wander this much more than normal fireflies. */
export const BONUS_DRIFT_SCALE = 1.6;

export interface Difficulty {
  pace: number;
  phase: PhaseId;
  phaseName: string;
  phaseIndex: PhaseIndex;
  spawnEvery: number;
  maxAlive: number;
  life: number;
  sizeScale: number;
  drift: number;
  bonusEvery: number;
  streakWindow: number;
}

/**
 * 0 → 1. Blends the clock and the score, so a strong player reaches Midnight
 * early and everyone gets there by the end. `elapsed` excludes frozen time.
 */
export function pace(elapsed: number, score: number, total = ROUND_SECONDS): number {
  const p = (0.4 * Math.max(0, elapsed)) / total + (0.6 * Math.max(0, score)) / PACE_SCORE;
  return Math.max(0, Math.min(1, p));
}

/** Every curve value for the moment, plus the phase. `elapsed` is in seconds. */
export function difficulty(elapsed: number, total = ROUND_SECONDS, score = 0): Difficulty {
  const p = pace(elapsed, score, total);
  const i = Math.min(2, Math.floor(p * 3)) as PhaseIndex;
  const k = p * 3 - i;
  const at = (curve: readonly number[]) => curve[i]! + (curve[i + 1]! - curve[i]!) * k;
  const phase = PHASES[i];
  return {
    pace: p,
    phase: phase.id,
    phaseName: phase.name,
    phaseIndex: i,
    spawnEvery: at(CURVE.spawnEvery),
    maxAlive: Math.round(at(CURVE.maxAlive)),
    life: at(CURVE.life),
    sizeScale: at(CURVE.sizeScale),
    drift: at(CURVE.drift),
    bonusEvery: at(CURVE.bonusEvery),
    streakWindow: at(CURVE.streakWindow),
  };
}

/** ×1 for streaks 0–4, ×2 from the 5th catch in a row, ×3 from the 10th. */
export function comboFor(streak: number): Combo {
  return streak >= 10 ? 3 : streak >= 5 ? 2 : 1;
}

/** Points for one catch; `streak` already includes it. A Lantern is a flat 5. */
export function pointsFor(kind: SpawnKind, streak: number): number {
  return kind === 'lantern' ? BONUSES.lantern.points : comboFor(streak);
}

/**
 * Picks the next bonus by weight. Frost leaves the pool once the player has
 * caught `maxPerRound` of them. Draws one number from `random`.
 */
export function pickBonus(random: () => number, frostsCaught: number): BonusKind {
  const pool = (Object.keys(BONUSES) as BonusKind[]).filter(
    (kind) => kind !== 'frost' || frostsCaught < BONUSES.frost.maxPerRound,
  );
  const total = pool.reduce((sum, kind) => sum + BONUSES[kind].weight, 0);
  let x = random() * total;
  for (const kind of pool) {
    x -= BONUSES[kind].weight;
    if (x <= 0) return kind;
  }
  return pool[0]!;
}
