import { describe, expect, it } from 'vitest';
import { createRandom } from './random';
import { BONUSES } from './rules';
import {
  hitTest,
  MAX_ROUND_TICKS,
  MEADOW_SHARE,
  replayRound,
  Round,
  type Field,
  type Firefly,
  type RoundConfig,
  type RoundEvent,
} from './simulation';

const PHONE: Field = { width: 390, height: 844, top: 100 };
const config = (seed: number, field: Field = PHONE): RoundConfig => ({ seed, field });

/** Steps until an event matches, and returns it with the round paused right after that tick. */
function stepUntil<T extends RoundEvent>(round: Round, match: (e: RoundEvent) => e is T) {
  while (!round.state.ended) {
    const found = round.step().find(match);
    if (found) return found;
  }
  return undefined;
}

const isSpawnOf =
  (kind: Firefly['kind']) =>
  (e: RoundEvent): e is Extract<RoundEvent, { type: 'spawn' }> =>
    e.type === 'spawn' && e.firefly.kind === kind;

/** Plays a whole round: taps the firefly closest to fading every `every` ticks. */
function playThrough(round: Round, every = 20) {
  while (!round.state.ended) {
    if (round.state.tick % every === 0) {
      const target = [...round.state.fireflies].sort((a, b) => a.life - b.life)[0];
      if (target) round.tap(target.x, target.y);
    }
    round.step();
  }
  return round.state;
}

/** Finds a seed whose untouched round spawns a bonus of `kind`, and stops there. */
function roundWithBonus(kind: Firefly['kind']) {
  for (let seed = 1; seed < 200; seed++) {
    const round = new Round(config(seed));
    const spawn = stepUntil(round, isSpawnOf(kind));
    if (spawn)
      return { round, firefly: round.state.fireflies.find((f) => f.id === spawn.firefly.id)! };
  }
  throw new Error(`No ${kind} in 200 seeds`);
}

describe('a round', () => {
  it('lasts exactly 30 s of play when nothing is caught', () => {
    const round = new Round(config(1));
    const ends: RoundEvent[] = [];
    while (!round.state.ended) ends.push(...round.step().filter((e) => e.type === 'end'));
    expect(round.state.tick).toBe(3000);
    expect(round.state.elapsedMs).toBe(30_000);
    expect(ends).toHaveLength(1);
    expect(round.state.score).toBe(0);
  });

  it('opens gently: the first firefly arrives just under a second in', () => {
    const round = new Round(config(1));
    stepUntil(round, isSpawnOf('normal'));
    // 950 ms at pace 0; the clock has already nudged the pace up by then.
    expect(round.state.tick).toBe(94);
  });

  it('spawns inside the safe field: below the HUD, above the meadow, a diameter from the sides', () => {
    for (const field of [
      PHONE,
      { width: 540, height: 960, top: 100 },
      { width: 844, height: 390, top: 80 },
    ]) {
      const round = new Round(config(3, field));
      const spawned: Readonly<Firefly>[] = [];
      while (!round.state.ended) {
        for (const e of round.step()) if (e.type === 'spawn') spawned.push(e.firefly);
      }
      expect(spawned.length).toBeGreaterThan(20);
      for (const f of spawned) {
        expect(f.homeX).toBeGreaterThanOrEqual(2 * f.r);
        expect(f.homeX).toBeLessThanOrEqual(field.width - 2 * f.r);
        expect(f.homeY).toBeGreaterThanOrEqual(field.top + f.r);
        expect(f.homeY).toBeLessThanOrEqual(field.height * (1 - MEADOW_SHARE));
      }
    }
  });

  it('never has more than one bonus on the field, and none before 5 s', () => {
    const round = new Round(config(9));
    while (!round.state.ended) {
      const events = round.step();
      const bonuses = round.state.fireflies.filter((f) => f.kind in BONUSES);
      expect(bonuses.length).toBeLessThanOrEqual(1);
      if (events.some((e) => e.type === 'spawn' && e.firefly.kind in BONUSES)) {
        expect(round.state.elapsedMs).toBeGreaterThan(5000);
      }
    }
  });

  it('rejects a seed or field it could not replay', () => {
    expect(() => new Round(config(-1))).toThrow(RangeError);
    expect(() => new Round(config(1.5))).toThrow(RangeError);
    expect(() => new Round(config(1, { width: 0, height: 844, top: 100 }))).toThrow(RangeError);
    expect(() => new Round(config(1, { width: 390, height: 844, top: 900 }))).toThrow(RangeError);
  });
});

describe('tapping', () => {
  it('catches a firefly, scores 1 and removes it at once', () => {
    const round = new Round(config(1));
    stepUntil(round, isSpawnOf('normal'));
    const target = round.state.fireflies[0]!;

    const caught = round.tap(target.x, target.y);

    expect(caught).toMatchObject({ type: 'catch', points: 1, streak: 1, combo: 1 });
    expect(round.state).toMatchObject({ score: 1, caught: 1, streak: 1 });
    expect(round.state.fireflies).not.toContain(target);
  });

  it('logs every tap against the tick it landed on, misses included', () => {
    const round = new Round(config(1));
    for (let i = 0; i < 7; i++) round.step();
    expect(round.tap(5, 5)).toBeNull();
    expect(round.taps).toEqual([{ tick: 7, x: 5, y: 5 }]);
  });

  it('ignores taps once the round is over, and does not log them', () => {
    const round = new Round(config(1));
    while (!round.state.ended) round.step();
    expect(round.tap(100, 400)).toBeNull();
    expect(round.taps).toHaveLength(0);
  });

  it('doubles points from the 5th catch in a row and triples them from the 10th', () => {
    const round = new Round(config(4));
    const points: number[] = [];
    while (points.length < 12 && !round.state.ended) {
      const target = round.state.fireflies.find((f) => f.kind === 'normal');
      if (target) points.push(round.tap(target.x, target.y)!.points);
      round.step();
    }
    expect(points).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3]);
    expect(round.state.topCombo).toBe(3);
  });

  it('loses the streak when a normal firefly fades uncaught', () => {
    const round = new Round(config(1));
    stepUntil(round, isSpawnOf('normal'));
    const first = round.state.fireflies[0]!;
    round.tap(first.x, first.y);

    let events: RoundEvent[] = [];
    while (!events.some((e) => e.type === 'streak-lost')) events = round.step();

    // The next firefly fades before the 3 s streak clock would run out.
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'fade',
        firefly: expect.objectContaining({ kind: 'normal' }),
      }),
    );
    expect(round.state.streak).toBe(0);
    expect(round.state.elapsedMs).toBeLessThan(950 + 3000);
  });
});

describe('hitTest', () => {
  const firefly = (id: number, x: number, life: number): Firefly => ({
    id,
    kind: 'normal',
    homeX: x,
    homeY: 400,
    x,
    y: 400,
    r: 36,
    lifeMs: 1900,
    ageMs: 0,
    life,
    drift: 0,
    driftMs: 0,
    phase: 0,
  });

  it('reaches the visible radius plus the slop, and no further', () => {
    const f = firefly(1, 200, 1); // visible radius 36, reach 46
    expect(hitTest([f], 245.9, 400)).toBe(f);
    expect(hitTest([f], 246.1, 400)).toBeUndefined();
  });

  it('shrinks with the light: a fading firefly is harder to catch', () => {
    const f = firefly(1, 200, 0.25); // visible radius 36 × 0.379 ≈ 13.6
    expect(hitTest([f], 220, 400)).toBe(f);
    expect(hitTest([f], 225, 400)).toBeUndefined();
  });

  it('takes the one closer to fading when a tap covers two', () => {
    const fresh = firefly(1, 200, 0.9);
    const fading = firefly(2, 230, 0.4);
    expect(hitTest([fresh, fading], 215, 400)).toBe(fading);
  });
});

describe('bonuses', () => {
  it('Lantern scores a flat 5', () => {
    const { round, firefly } = roundWithBonus('lantern');
    expect(round.tap(firefly.x, firefly.y)).toMatchObject({ points: 5 });
  });

  it('Frost stops the clock, the fading and the streak clock for 3 s', () => {
    const { round, firefly } = roundWithBonus('frost');
    round.tap(firefly.x, firefly.y);
    const before = { ...round.state };
    const ages = round.state.fireflies.map((f) => f.ageMs);

    for (let i = 0; i < 300; i++) round.step();

    expect(round.state.elapsedMs).toBe(before.elapsedMs);
    expect(round.state.streakLeftMs).toBe(before.streakLeftMs);
    expect(round.state.fireflies.slice(0, ages.length).map((f) => f.ageMs)).toEqual(ages);
    expect(round.state.frozenMs).toBe(0);
    round.step();
    expect(round.state.elapsedMs).toBe(before.elapsedMs + 10);
  });

  it('a round with a freeze lasts 300 ticks longer', () => {
    const { round, firefly } = roundWithBonus('frost');
    round.tap(firefly.x, firefly.y);
    while (!round.state.ended) round.step();
    expect(round.state.tick).toBe(3000 + 300);
  });

  it('Swarm releases six small, quick fireflies', () => {
    const { round, firefly } = roundWithBonus('swarm');
    round.tap(firefly.x, firefly.y);
    const motes: Readonly<Firefly>[] = [];
    for (let i = 0; i < 300; i++) {
      for (const e of round.step())
        if (e.type === 'spawn' && e.firefly.kind === 'swarm-mote') motes.push(e.firefly);
    }
    expect(motes).toHaveLength(6);
    expect(motes.every((m) => m.lifeMs === BONUSES.swarm.moteLife)).toBe(true);
  });

  it('a missed bonus never costs the streak', () => {
    const { round } = roundWithBonus('lantern');
    const normal = round.state.fireflies.find((f) => f.kind === 'normal');
    expect(normal).toBeDefined();
    round.tap(normal!.x, normal!.y);
    const events: RoundEvent[] = [];
    while (round.state.fireflies.some((f) => f.kind === 'lantern')) events.push(...round.step());
    const lanternFaded = events.findIndex((e) => e.type === 'fade' && e.firefly.kind === 'lantern');
    expect(events[lanternFaded + 1]?.type).not.toBe('streak-lost');
  });
});

describe('replay', () => {
  // The client steps a jittery number of ticks per animation frame (60 Hz, 120 Hz,
  // dropped frames) and taps between frames. The server replays tick by tick.
  function playLive(seed: number, field: Field = PHONE) {
    const round = new Round(config(seed, field));
    const frames = createRandom(seed ^ 0x5eed);
    while (!round.state.ended) {
      const fireflies = round.state.fireflies;
      const roll = frames();
      if (roll < 0.3 && fireflies.length) {
        const f = fireflies[Math.floor(roll * 10) % fireflies.length]!;
        round.tap(f.x + (roll - 0.15) * 300, f.y); // up to 45 px off: some hit, some miss
      }
      const ticksThisFrame = 1 + Math.floor(frames() * 3);
      for (let i = 0; i < ticksThisFrame && !round.state.ended; i++) round.step();
    }
    return round;
  }

  it('reproduces live play exactly, whatever the frame rate', () => {
    for (let seed = 1; seed <= 40; seed++) {
      const live = playLive(seed);
      const { score, caught, topCombo, tick } = live.state;
      expect(replayRound(live.config, live.taps)).toEqual({
        score,
        caught,
        topCombo,
        ticks: tick,
        lateTaps: 0,
      });
    }
  });

  it('reproduces rounds on other frame sizes too', () => {
    for (const field of [
      { width: 540, height: 960, top: 120 },
      { width: 1024, height: 600, top: 100 },
    ]) {
      const live = playLive(11, field);
      expect(replayRound(live.config, live.taps).score).toBe(live.state.score);
    }
  });

  it('gives a different round for a different seed', () => {
    const firstSpawn = (seed: number) =>
      stepUntil(new Round(config(seed)), isSpawnOf('normal'))!.firefly;
    expect(firstSpawn(1).homeX).not.toBe(firstSpawn(2).homeX);
  });

  it('gives the same round, tap for tap, for the same seed', () => {
    const a = playThrough(new Round(config(8)));
    const b = playThrough(new Round(config(8)));
    expect(a).toEqual(b);
  });

  it('counts taps after the end without scoring them', () => {
    const live = playLive(5);
    const late = [...live.taps, { tick: live.state.tick + 50, x: 100, y: 400 }];
    expect(replayRound(live.config, late)).toMatchObject({ score: live.state.score, lateTaps: 1 });
  });

  it('rejects taps out of tick order', () => {
    expect(() =>
      replayRound(config(1), [
        { tick: 10, x: 1, y: 1 },
        { tick: 5, x: 1, y: 1 },
      ]),
    ).toThrow(RangeError);
  });

  it('scores nothing for taps where no firefly was', () => {
    const taps = Array.from({ length: 300 }, (_, i) => ({ tick: i * 10, x: 1, y: 1 }));
    expect(replayRound(config(1), taps).score).toBe(0);
  });

  it('always ends within MAX_ROUND_TICKS, even catching every Frost', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const state = playThrough(new Round(config(seed)), 1);
      expect(state.tick).toBeLessThanOrEqual(MAX_ROUND_TICKS);
      expect(state.frostsCaught).toBeLessThanOrEqual(BONUSES.frost.maxPerRound);
    }
  });
});
