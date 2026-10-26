// The UI kit carries its own copy of the rules for its demos; the game scores
// with @glowcatch/shared. These tests fail if the two drift apart, for example
// after a design-system re-sync changes a number in the kit.
import {
  BONUSES,
  comboFor,
  CURVE,
  difficulty,
  FIREFLY_START,
  HIT_SLOP,
  PHASES,
  pointsFor,
  type SpawnKind,
} from '@glowcatch/shared';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

interface KitRules {
  CURVE: unknown;
  PHASES: unknown;
  BONUSES: unknown;
  difficulty(elapsed: number, total: number, score: number): unknown;
  comboFor(streak: number): number;
  pointsFor(kind: string, streak: number): number;
}

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const sandbox: { window: { Glowcatch?: KitRules } } = { window: {} };
runInNewContext(read('../src/kit/bundle.js'), sandbox);
const kit = sandbox.window.Glowcatch!;
// Plain data, so objects from the sandbox compare like local ones.
const plain = (value: unknown) => JSON.parse(JSON.stringify(value));

describe('the kit and @glowcatch/shared', () => {
  it('have the same curve, phases and bonuses', () => {
    expect(plain(kit.CURVE)).toEqual(plain(CURVE));
    expect(plain(kit.PHASES)).toEqual(plain(PHASES));
    expect(plain(kit.BONUSES)).toEqual(plain(BONUSES));
  });

  it('compute the same difficulty across a round', () => {
    for (let elapsed = 0; elapsed <= 30; elapsed += 1.5) {
      for (let score = 0; score <= 120; score += 7) {
        expect(plain(kit.difficulty(elapsed, 30, score))).toEqual(
          plain(difficulty(elapsed, 30, score)),
        );
      }
    }
  });

  it('score catches the same way', () => {
    const kinds: SpawnKind[] = ['normal', 'lantern', 'frost', 'swarm', 'swarm-mote'];
    for (let streak = 0; streak <= 15; streak++) {
      expect(kit.comboFor(streak)).toBe(comboFor(streak));
      for (const kind of kinds) expect(kit.pointsFor(kind, streak)).toBe(pointsFor(kind, streak));
    }
  });
});

describe('the design tokens and @glowcatch/shared', () => {
  const tokens = JSON.parse(read('../src/kit/tokens.json'));
  const value = (family: string, name: string): number =>
    parseFloat(tokens[family].tokens.find((t: { name: string }) => t.name === name).value);

  it('agree on firefly size and hit slop', () => {
    expect(value('size', 'firefly-start')).toBe(FIREFLY_START);
    expect(value('size', 'firefly-hit-slop')).toBe(HIT_SLOP);
  });

  it('agree on the freeze, the swarm and the streak clock', () => {
    expect(value('duration', 'dur-freeze')).toBe(BONUSES.frost.freezeMs);
    expect(value('duration', 'dur-swarm')).toBe(BONUSES.swarm.windowMs);
    expect(value('duration', 'dur-streak')).toBe(CURVE.streakWindow[0]);
  });
});
