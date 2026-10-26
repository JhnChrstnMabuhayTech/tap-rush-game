import type { CatchEvent, Firefly } from '@glowcatch/shared';
import { describe, expect, it } from 'vitest';
import { phaseBanner, popupsFor } from './feedback';

const caught = (kind: Firefly['kind'], points: number, combo: 1 | 2 | 3, comboUp = false) =>
  ({ type: 'catch', firefly: { kind }, points, streak: 1, combo, comboUp }) as CatchEvent;

describe('popupsFor', () => {
  it('shows the points in a tone that follows the multiplier', () => {
    expect(popupsFor(caught('normal', 1, 1))).toEqual([{ text: '+1', tone: 'ink', at: 'catch' }]);
    expect(popupsFor(caught('normal', 2, 2))[0]).toMatchObject({ text: '+2', tone: 'lime' });
    expect(popupsFor(caught('swarm-mote', 3, 3))[0]).toMatchObject({ text: '+3', tone: 'glow' });
  });

  it('shows a Lantern as a big +5', () => {
    expect(popupsFor(caught('lantern', 5, 1))).toEqual([
      { text: '+5', tone: 'glow', big: true, at: 'catch' },
    ]);
  });

  it('announces Frost high on the field, and Swarm above the catch', () => {
    expect(popupsFor(caught('frost', 1, 1))[1]).toMatchObject({ text: 'Frozen 3s', at: 'banner' });
    expect(popupsFor(caught('swarm', 1, 1))[1]).toMatchObject({ text: 'Swarm', at: 'above' });
  });

  it('adds the new multiplier when it goes up', () => {
    expect(popupsFor(caught('normal', 2, 2, true))[1]).toMatchObject({
      text: '×2 combo',
      tone: 'lime',
    });
    expect(popupsFor(caught('normal', 3, 3, true))[1]).toMatchObject({
      text: '×3 combo',
      tone: 'glow',
    });
  });
});

describe('phaseBanner', () => {
  it('uses the copy deck for both phase changes', () => {
    expect(phaseBanner(1)).toEqual({
      step: 'Phase 2 of 3',
      name: 'Night falls',
      hint: 'Faster and smaller',
    });
    expect(phaseBanner(2)).toEqual({
      step: 'Phase 3 of 3',
      name: 'Midnight',
      hint: 'Last stretch',
    });
  });
});
