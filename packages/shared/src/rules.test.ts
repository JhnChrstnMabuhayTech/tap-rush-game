import { describe, expect, it } from 'vitest';
import { BONUSES, comboFor, CURVE, difficulty, pace, pickBonus, pointsFor } from './rules';

describe('pace', () => {
  it('blends time (40%) and score (60%)', () => {
    expect(pace(15, 0)).toBeCloseTo(0.2);
    expect(pace(0, 45)).toBeCloseTo(0.3);
    expect(pace(15, 45)).toBeCloseTo(0.5);
  });

  it('stays between 0 and 1', () => {
    expect(pace(-5, -10)).toBe(0);
    expect(pace(30, 500)).toBe(1);
  });

  it('gives 0.4 from time alone by the end of the round', () => {
    expect(pace(30, 0)).toBeCloseTo(0.4);
  });
});

describe('difficulty', () => {
  it('opens on the first column of the curve, in Dusk', () => {
    const d = difficulty(0, 30, 0);
    expect(d).toMatchObject({ pace: 0, phase: 'dusk', phaseIndex: 0, phaseName: 'Dusk' });
    expect(d.spawnEvery).toBe(950);
    expect(d.maxAlive).toBe(2);
    expect(d.life).toBe(1900);
    expect(d.streakWindow).toBe(3000);
  });

  it('ends on the last column at full pace, in Midnight', () => {
    const d = difficulty(30, 30, 90);
    expect(d).toMatchObject({ pace: 1, phase: 'midnight', phaseIndex: 2 });
    expect(d.spawnEvery).toBe(CURVE.spawnEvery[3]);
    expect(d.life).toBe(CURVE.life[3]);
    expect(d.sizeScale).toBe(CURVE.sizeScale[3]);
  });

  it('interpolates linearly between columns', () => {
    // A score of 25 gives pace 1/6: halfway between the first two columns.
    const d = difficulty(0, 30, 25);
    expect(d.pace).toBeCloseTo(1 / 6);
    expect(d.spawnEvery).toBeCloseTo((950 + 620) / 2);
    expect(d.life).toBeCloseTo((1900 + 1450) / 2);
  });

  it('changes phase at ⅓ and ⅔ of the pace', () => {
    expect(difficulty(0, 30, 49).phase).toBe('dusk'); // pace 0.327
    expect(difficulty(0, 30, 51).phase).toBe('night'); // pace 0.34
    expect(difficulty(0, 30, 99).phase).toBe('night'); // pace 0.66
    expect(difficulty(0, 30, 101).phase).toBe('midnight'); // pace 0.673
  });

  it('rounds the number of fireflies alive at once', () => {
    expect(Number.isInteger(difficulty(10, 30, 17).maxAlive)).toBe(true);
  });
});

describe('comboFor', () => {
  it('is ×1 up to 4 in a row, ×2 from 5, ×3 from 10', () => {
    expect([0, 1, 4, 5, 9, 10, 40].map(comboFor)).toEqual([1, 1, 1, 2, 2, 3, 3]);
  });
});

describe('pointsFor', () => {
  it('scores every catch at the combo multiplier', () => {
    expect(pointsFor('normal', 1)).toBe(1);
    expect(pointsFor('normal', 5)).toBe(2);
    expect(pointsFor('frost', 10)).toBe(3);
    expect(pointsFor('swarm', 7)).toBe(2);
    expect(pointsFor('swarm-mote', 12)).toBe(3);
  });

  it('scores a Lantern a flat 5, whatever the combo', () => {
    expect(pointsFor('lantern', 1)).toBe(5);
    expect(pointsFor('lantern', 12)).toBe(5);
  });
});

describe('pickBonus', () => {
  const at = (x: number) => () => x;

  it('picks by weight: Lantern 40, Frost 35, Swarm 25', () => {
    expect(pickBonus(at(0), 0)).toBe('lantern');
    expect(pickBonus(at(0.39), 0)).toBe('lantern');
    expect(pickBonus(at(0.41), 0)).toBe('frost');
    expect(pickBonus(at(0.74), 0)).toBe('frost');
    expect(pickBonus(at(0.76), 0)).toBe('swarm');
    expect(pickBonus(at(0.999), 0)).toBe('swarm');
  });

  it('stops offering Frost once two have been caught', () => {
    const picks = new Set(
      Array.from({ length: 100 }, (_, i) => pickBonus(at(i / 100), BONUSES.frost.maxPerRound)),
    );
    expect(picks).toEqual(new Set(['lantern', 'swarm']));
  });
});
