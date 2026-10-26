// The round as a deterministic simulation. The game runs it live; the server
// replays it from the seed and the tap log. Both must land on the same score,
// bit for bit, so:
// - time moves in fixed ticks (TICK_MS), and taps apply between ticks;
// - positions are logical units: the play frame's CSS size at round start;
// - one seeded generator, drawn in a fixed order;
// - decisions use + − × ÷ and exact Math helpers only (see curves.ts).
// Otherwise it follows the UI kit's reference loop (its PlayField demo).

import { shrink, wave } from './curves';
import { createRandom, isSeed, type Random } from './random';
import {
  BONUS_DRIFT_SCALE,
  BONUSES,
  comboFor,
  difficulty,
  FIRST_BONUS_SECONDS,
  pickBonus,
  pointsFor,
  ROUND_SECONDS,
  type BonusKind,
  type Combo,
  type Difficulty,
  type PhaseIndex,
  type SpawnKind,
} from './rules';

/** One simulation step: 100 a second. */
export const TICK_MS = 10;
export const ROUND_MS = ROUND_SECONDS * 1000;
/** The longest a round can run: 30 s of play plus every freeze it allows. */
export const MAX_ROUND_TICKS =
  (ROUND_MS + BONUSES.frost.maxPerRound * BONUSES.frost.freezeMs) / TICK_MS;

/** Diameter at spawn on a 390-wide frame (design token `firefly-start`). */
export const FIREFLY_START = 72;
/** Extra radius a tap may miss by and still catch (design token `firefly-hit-slop`). */
export const HIT_SLOP = 10;
/** The meadow along the bottom of the frame; nothing spawns in it. */
export const MEADOW_SHARE = 0.12;

const REFERENCE_SHORT_SIDE = 390;
const MAX_SIZE_SCALE = 1.25;
const SPAWN_TRIES = 10;
/** The bonus clock starts part-way, so the first bonus comes soon after FIRST_BONUS_SECONDS. */
const BONUS_HEAD_START_MS = 4000;
/** Up to this much extra wait after each bonus, so they don't arrive like clockwork. */
const BONUS_JITTER_MS = 1500;
const DRIFT_PERIOD_X_MS = 4400;
const DRIFT_PERIOD_Y_MS = 5650;
const DRIFT_Y_SCALE = 0.8;
const GOLDEN_RATIO = 0.6180339887498949;

export interface Field {
  /** Logical size: the play frame's CSS size when the round starts. */
  width: number;
  height: number;
  /** The HUD band at the top, safe-area inset included. Nothing spawns above it. */
  top: number;
}

export interface RoundConfig {
  /** Unsigned 32-bit; issued by the server. */
  seed: number;
  field: Field;
}

/** A tap as the game logs it and the server replays it. */
export interface Tap {
  /** Ticks completed when the tap landed; it applies before the next tick. */
  tick: number;
  x: number;
  y: number;
}

export interface Firefly {
  readonly id: number;
  readonly kind: SpawnKind;
  /** Where it spawned; it drifts around this point. */
  readonly homeX: number;
  readonly homeY: number;
  /** Where it is now. */
  x: number;
  y: number;
  /** Radius at spawn. Visible radius: r × shrink(life). */
  readonly r: number;
  readonly lifeMs: number;
  ageMs: number;
  /** 1 at spawn, 0 when its light is gone. */
  life: number;
  /** How far it wanders from home. */
  readonly drift: number;
  /** Its own clock for drifting; stops while time is frozen. */
  driftMs: number;
  /** Where in its wander it starts, in turns. */
  readonly phase: number;
}

export interface RoundState {
  /** Ticks completed. A tap now is logged against this tick. */
  tick: number;
  /** ms of play, frozen time excluded. The round ends at ROUND_MS. */
  elapsedMs: number;
  /** ms of freeze left; 0 when time is running. */
  frozenMs: number;
  score: number;
  /** Fireflies caught, one each whatever they scored. */
  caught: number;
  streak: number;
  /** ms left on the streak clock; 0 without a streak. */
  streakLeftMs: number;
  /** The highest multiplier reached. */
  topCombo: Combo;
  phaseIndex: PhaseIndex;
  frostsCaught: number;
  ended: boolean;
  /** The curve right now; `streakWindow` is the streak clock's full length. */
  difficulty: Difficulty;
  /** Live fireflies, oldest first. Caught ones leave at once. */
  fireflies: Firefly[];
}

export type RoundEvent =
  | { type: 'spawn'; firefly: Readonly<Firefly> }
  | {
      type: 'catch';
      firefly: Readonly<Firefly>;
      points: number;
      /** The streak including this catch. */
      streak: number;
      combo: Combo;
      /** This catch raised the multiplier. */
      comboUp: boolean;
    }
  | { type: 'fade'; firefly: Readonly<Firefly> }
  | { type: 'streak-lost' }
  | { type: 'phase'; phaseIndex: PhaseIndex }
  | { type: 'end' };

export type CatchEvent = Extract<RoundEvent, { type: 'catch' }>;

export class Round {
  readonly config: Readonly<RoundConfig>;
  private readonly random: Random;
  private readonly baseDiameter: number;
  private readonly log: Tap[] = [];
  private readonly s: RoundState;
  private spawnAcc = 0;
  private bonusAcc = BONUS_HEAD_START_MS;
  private swarmLeft = 0;
  private swarmAcc = 0;
  private nextId = 1;

  constructor(config: RoundConfig) {
    const { seed, field } = config;
    if (!isSeed(seed)) throw new RangeError(`Seed must be an unsigned 32-bit integer: ${seed}`);
    if (![field.width, field.height].every((n) => Number.isFinite(n) && n > 0)) {
      throw new RangeError('Field width and height must be positive');
    }
    if (!(Number.isFinite(field.top) && field.top >= 0 && field.top < field.height)) {
      throw new RangeError('Field top must be inside the field');
    }
    this.config = { seed, field: { ...field } };
    this.random = createRandom(seed);
    const shortSide = Math.min(field.width, field.height);
    this.baseDiameter = FIREFLY_START * Math.min(MAX_SIZE_SCALE, shortSide / REFERENCE_SHORT_SIDE);
    this.s = {
      tick: 0,
      elapsedMs: 0,
      frozenMs: 0,
      score: 0,
      caught: 0,
      streak: 0,
      streakLeftMs: 0,
      topCombo: 1,
      phaseIndex: 0,
      frostsCaught: 0,
      ended: false,
      difficulty: difficulty(0),
      fireflies: [],
    };
  }

  get state(): Readonly<RoundState> {
    return this.s;
  }

  /** Every tap so far, in order: what the game sends with its score. */
  get taps(): readonly Tap[] {
    return this.log;
  }

  /**
   * A tap at logical (x, y), applied now, between ticks. Logged unless the round
   * has ended. Returns the catch, or null for a miss.
   */
  tap(x: number, y: number): CatchEvent | null {
    const s = this.s;
    if (s.ended) return null;
    this.log.push({ tick: s.tick, x, y });
    const target = hitTest(s.fireflies, x, y);
    return target ? this.catch(target) : null;
  }

  /** Advances one tick and reports what happened in it. */
  step(): RoundEvent[] {
    const s = this.s;
    const events: RoundEvent[] = [];
    s.tick += 1;

    // After the end nothing is decided; live fireflies just finish fading.
    if (s.ended) {
      this.age(false, events);
      return events;
    }

    const frozen = s.frozenMs > 0;
    if (frozen) s.frozenMs = Math.max(0, s.frozenMs - TICK_MS);
    else s.elapsedMs += TICK_MS;
    const d = (s.difficulty = this.difficultyNow());

    if (s.streak > 0 && !frozen) {
      s.streakLeftMs -= TICK_MS;
      if (s.streakLeftMs <= 0) this.loseStreak(events);
    }

    if (d.phaseIndex > s.phaseIndex) {
      s.phaseIndex = d.phaseIndex;
      events.push({ type: 'phase', phaseIndex: d.phaseIndex });
    }

    if (s.elapsedMs >= ROUND_MS) {
      s.ended = true;
      events.push({ type: 'end' });
    } else {
      this.spawnNormal(d, events);
      this.spawnBonus(d, frozen, events);
      this.releaseSwarm(d, events);
    }

    this.age(frozen, events);
    return events;
  }

  private difficultyNow(): Difficulty {
    return difficulty(this.s.elapsedMs / 1000, ROUND_SECONDS, this.s.score);
  }

  private catch(firefly: Firefly): CatchEvent {
    const s = this.s;
    s.fireflies = s.fireflies.filter((f) => f !== firefly);
    const before = comboFor(s.streak);
    s.streak += 1;
    const points = pointsFor(firefly.kind, s.streak);
    const combo = comboFor(s.streak);
    s.score += points;
    s.caught += 1;
    if (combo > s.topCombo) s.topCombo = combo;
    s.difficulty = this.difficultyNow();
    s.streakLeftMs = s.difficulty.streakWindow;

    if (firefly.kind === 'frost') {
      s.frozenMs = BONUSES.frost.freezeMs;
      s.frostsCaught += 1;
    } else if (firefly.kind === 'swarm') {
      this.swarmLeft = BONUSES.swarm.count;
      this.swarmAcc = 0;
    }
    return { type: 'catch', firefly, points, streak: s.streak, combo, comboUp: combo > before };
  }

  private loseStreak(events: RoundEvent[]) {
    this.s.streak = 0;
    this.s.streakLeftMs = 0;
    events.push({ type: 'streak-lost' });
  }

  private spawnNormal(d: Difficulty, events: RoundEvent[]) {
    this.spawnAcc += TICK_MS;
    if (this.spawnAcc < d.spawnEvery) return;
    const normals = this.s.fireflies.filter((f) => f.kind === 'normal').length;
    if (normals < d.maxAlive) {
      // Carry the remainder, so the cadence doesn't depend on tick rounding.
      this.spawnAcc -= d.spawnEvery;
      events.push(this.spawn('normal', d));
    } else {
      // The field is full: spawn as soon as a slot frees up, without a backlog.
      this.spawnAcc = d.spawnEvery;
    }
  }

  private spawnBonus(d: Difficulty, frozen: boolean, events: RoundEvent[]) {
    if (!frozen) this.bonusAcc += TICK_MS;
    if (this.s.elapsedMs <= FIRST_BONUS_SECONDS * 1000 || this.bonusAcc < d.bonusEvery) return;
    if (this.s.fireflies.some((f) => isBonus(f.kind))) return;
    this.bonusAcc = -this.random() * BONUS_JITTER_MS;
    events.push(this.spawn(pickBonus(this.random, this.s.frostsCaught), d));
  }

  private releaseSwarm(d: Difficulty, events: RoundEvent[]) {
    if (this.swarmLeft === 0) return;
    const every = BONUSES.swarm.windowMs / BONUSES.swarm.count;
    this.swarmAcc += TICK_MS;
    if (this.swarmAcc < every) return;
    this.swarmAcc -= every;
    this.swarmLeft -= 1;
    events.push(this.spawn('swarm-mote', d));
  }

  private spawn(kind: SpawnKind, d: Difficulty): RoundEvent {
    const { width, height, top } = this.config.field;
    const bonus = isBonus(kind) ? BONUSES[kind] : null;
    const scale = kind === 'swarm-mote' ? BONUSES.swarm.moteScale : bonus ? bonus.sizeScale : 1;
    const diameter = this.baseDiameter * d.sizeScale * scale;

    // One diameter in from the sides, below the HUD band, above the meadow,
    // and clear of the fireflies already there (10 tries, then take the last).
    const minY = top + diameter / 2;
    const spanX = Math.max(0, width - 2 * diameter);
    const spanY = Math.max(1, height * (1 - MEADOW_SHARE) - diameter / 2 - minY);
    let x = 0;
    let y = 0;
    for (let tries = 0; tries < SPAWN_TRIES; tries++) {
      x = diameter + this.random() * spanX;
      y = minY + this.random() * spanY;
      if (!this.crowded(x, y, diameter)) break;
    }

    const id = this.nextId++;
    const firefly: Firefly = {
      id,
      kind,
      homeX: x,
      homeY: y,
      x,
      y,
      r: diameter / 2,
      lifeMs: kind === 'swarm-mote' ? BONUSES.swarm.moteLife : bonus ? bonus.life : d.life,
      ageMs: 0,
      life: 1,
      drift: d.drift * (bonus ? BONUS_DRIFT_SCALE : 1),
      driftMs: 0,
      phase: (id * GOLDEN_RATIO) % 1,
    };
    place(firefly);
    this.s.fireflies.push(firefly);
    return { type: 'spawn', firefly };
  }

  private crowded(x: number, y: number, diameter: number): boolean {
    return this.s.fireflies.some((f) => {
      const dx = f.x - x;
      const dy = f.y - y;
      const clearance = 1.2 * (diameter + f.r);
      return dx * dx + dy * dy < clearance * clearance;
    });
  }

  /** Ages, fades and moves every live firefly by one tick. */
  private age(frozen: boolean, events: RoundEvent[]) {
    const s = this.s;
    const alive: Firefly[] = [];
    for (const f of s.fireflies) {
      if (!frozen) f.ageMs += TICK_MS;
      f.life = 1 - f.ageMs / f.lifeMs;
      if (f.life <= 0) {
        events.push({ type: 'fade', firefly: f });
        // Only a normal firefly fading ends the streak; a missed bonus never does.
        if (f.kind === 'normal' && !s.ended && s.streak > 0) this.loseStreak(events);
        continue;
      }
      if (!frozen) {
        f.driftMs += TICK_MS;
        place(f);
      }
      alive.push(f);
    }
    s.fireflies = alive;
  }
}

/**
 * The firefly a tap at (x, y) catches: within its visible radius plus HIT_SLOP,
 * and of several, the one closest to fading (the oldest on a tie).
 */
export function hitTest(fireflies: readonly Firefly[], x: number, y: number): Firefly | undefined {
  let target: Firefly | undefined;
  for (const f of fireflies) {
    const reach = f.r * shrink(f.life) + HIT_SLOP;
    const dx = f.x - x;
    const dy = f.y - y;
    if (dx * dx + dy * dy <= reach * reach && (!target || f.life < target.life)) target = f;
  }
  return target;
}

export interface ReplayResult {
  score: number;
  caught: number;
  topCombo: Combo;
  /** Ticks the round took: 3000, plus 300 for each freeze. */
  ticks: number;
  /** Taps logged after the round ended. The game never records any. */
  lateTaps: number;
  /** Every catch, in order, with when its firefly appeared: the server's plausibility checks. */
  catches: CatchTiming[];
}

export interface CatchTiming {
  kind: SpawnKind;
  /** Ticks completed when the firefly appeared, so the first tick it could be tapped. */
  spawnTick: number;
  /** Ticks completed when it was caught. Frozen ticks count: the player's clock kept running. */
  tick: number;
}

/**
 * Re-runs a round from its config and tap log, as the server does. Throws a
 * RangeError if the taps aren't in tick order.
 */
export function replayRound(config: RoundConfig, taps: readonly Tap[]): ReplayResult {
  const round = new Round(config);
  const spawnTicks = new Map<number, number>();
  const catches: CatchTiming[] = [];
  let next = 0;
  while (!round.state.ended) {
    const tick = round.state.tick;
    while (next < taps.length && taps[next]!.tick <= tick) {
      const tap = taps[next++]!;
      if (tap.tick !== tick) throw new RangeError(`Tap ${next - 1} is out of tick order`);
      const caught = round.tap(tap.x, tap.y);
      if (caught) {
        const { id, kind } = caught.firefly;
        catches.push({ kind, spawnTick: spawnTicks.get(id)!, tick });
      }
    }
    for (const event of round.step()) {
      if (event.type === 'spawn') spawnTicks.set(event.firefly.id, round.state.tick);
    }
    if (round.state.tick > MAX_ROUND_TICKS) throw new Error('Round ran past MAX_ROUND_TICKS');
  }
  const { score, caught, topCombo, tick } = round.state;
  return { score, caught, topCombo, ticks: tick, lateTaps: taps.length - next, catches };
}

function isBonus(kind: SpawnKind): kind is BonusKind {
  return kind in BONUSES;
}

function place(f: Firefly) {
  f.x = f.homeX + wave(f.driftMs / DRIFT_PERIOD_X_MS + f.phase) * f.drift;
  f.y = f.homeY + wave(f.driftMs / DRIFT_PERIOD_Y_MS + f.phase + 0.25) * f.drift * DRIFT_Y_SCALE;
}
