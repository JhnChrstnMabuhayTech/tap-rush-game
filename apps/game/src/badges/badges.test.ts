import { describe, expect, it } from 'vitest';
import { BADGES, earnedBadges, nextBadge, progressToNext, unlockedBadges } from './badges';

const names = (badges: readonly { name: string }[]) => badges.map((badge) => badge.name);

describe('BADGES', () => {
  it('climbs in score, with unique ids', () => {
    BADGES.slice(1).forEach((badge, i) => expect(badge.score).toBeGreaterThan(BADGES[i]!.score));
    expect(new Set(BADGES.map((badge) => badge.id)).size).toBe(BADGES.length);
  });

  it('keeps names short enough to translate (under 14 characters, sentence case)', () => {
    for (const { name } of BADGES) {
      expect(name.length).toBeLessThanOrEqual(14);
      expect(name.slice(1)).toBe(name.slice(1).toLowerCase());
    }
  });

  it('starts within reach of a first round', () => {
    expect(BADGES[0]!.score).toBeLessThanOrEqual(10);
  });
});

describe('earnedBadges', () => {
  it('is every badge at or below the best score', () => {
    expect(earnedBadges(0)).toEqual([]);
    expect(names(earnedBadges(10))).toEqual(['First light']);
    expect(names(earnedBadges(119))).toEqual(['First light', 'Spark catcher', 'Lantern keeper']);
    expect(earnedBadges(999)).toHaveLength(BADGES.length);
  });
});

describe('unlockedBadges', () => {
  it('is what this round crossed, and nothing already earned', () => {
    expect(names(unlockedBadges(0, 12))).toEqual(['First light']);
    expect(names(unlockedBadges(12, 80))).toEqual(['Spark catcher', 'Lantern keeper']);
    expect(unlockedBadges(80, 80)).toEqual([]);
  });

  it('is nothing for a round below the best', () => {
    expect(unlockedBadges(150, 60)).toEqual([]);
  });
});

describe('nextBadge and progressToNext', () => {
  it('points at the next badge and how far along the player is', () => {
    expect(nextBadge(0)?.name).toBe('First light');
    expect(nextBadge(50)?.name).toBe('Lantern keeper');
    // 50 is two sevenths of the way from 40 to 75.
    expect(progressToNext(50)).toBeCloseTo(10 / 35, 6);
    expect(progressToNext(0)).toBe(0);
  });

  it('is done when every badge is earned', () => {
    expect(nextBadge(300)).toBeUndefined();
    expect(progressToNext(300)).toBe(1);
  });
});
