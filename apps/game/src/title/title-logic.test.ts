import { describe, expect, it } from 'vitest';
import { hitTitleFirefly, nextVisitor, spawnArea, VISITOR_COPY } from './title-logic';

describe('spawnArea', () => {
  it('keeps title fireflies in the sky above the name, clear of the sides', () => {
    const area = spawnArea(390, 844, 470, 30, 0);
    expect(area.left).toBe(60);
    expect(area.right).toBe(330);
    expect(area.top).toBeGreaterThanOrEqual(64);
    expect(area.bottom).toBeLessThanOrEqual(470 - 30);
  });

  it('starts lower on phones with a notch', () => {
    expect(spawnArea(390, 844, 470, 30, 47).top).toBe(spawnArea(390, 844, 470, 30, 0).top + 47);
  });

  it('falls back to the top half when the name leaves no room', () => {
    const area = spawnArea(844, 390, 90, 30, 0);
    expect(area.top).toBe(60);
    expect(area.bottom).toBe(195);
  });
});

describe('nextVisitor', () => {
  it('takes turns: Lantern, Frost, Swarm, then Lantern again', () => {
    expect(nextVisitor(null)).toBe('lantern');
    expect(nextVisitor('lantern')).toBe('frost');
    expect(nextVisitor('frost')).toBe('swarm');
    expect(nextVisitor('swarm')).toBe('lantern');
  });

  it('names each bonus with the How to play copy', () => {
    expect(VISITOR_COPY.frost).toBe('Frost — Stops the clock for 3s');
  });
});

describe('hitTitleFirefly', () => {
  const at = (x: number, life = 1) => ({ x, y: 100, r: 30, life });

  it('catches within the visible radius plus a forgiving slop', () => {
    expect(hitTitleFirefly([at(100)], 145, 100)).toBeDefined();
    expect(hitTitleFirefly([at(100)], 147, 100)).toBeUndefined();
  });

  it('takes the nearest when a tap covers two', () => {
    const near = at(120);
    expect(hitTitleFirefly([at(80), near], 110, 100)).toBe(near);
  });

  it('gets harder to catch as the light fades', () => {
    expect(hitTitleFirefly([at(100, 0.1)], 130, 100)).toBeUndefined();
  });
});
