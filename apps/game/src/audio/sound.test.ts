import type { CatchEvent } from '@glowcatch/shared';
import { describe, expect, it } from 'vitest';
import { createSound } from './sound';

const memory = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

const caught = {
  type: 'catch',
  firefly: { kind: 'normal' },
  points: 1,
  streak: 1,
  combo: 1,
  comboUp: false,
} as CatchEvent;

describe('createSound', () => {
  it('has music and sound effects on by default', () => {
    const sound = createSound(memory());
    expect([sound.music, sound.effects]).toEqual([true, true]);
  });

  it('remembers music and sound effects separately', () => {
    const storage = memory();
    createSound(storage).setMusic(false);
    expect(storage.data.get('glowcatch.music')).toBe('off');
    let sound = createSound(storage);
    expect([sound.music, sound.effects]).toEqual([false, true]);

    sound.setEffects(false);
    sound.setMusic(true);
    sound = createSound(storage);
    expect([sound.music, sound.effects]).toEqual([true, false]);
  });

  it('keeps both off for a player who muted the old single Sound switch', () => {
    const sound = createSound(memory({ 'glowcatch.sound': 'off' }));
    expect([sound.music, sound.effects]).toEqual([false, false]);
  });

  it('lets a new setting override the old switch', () => {
    const sound = createSound(memory({ 'glowcatch.sound': 'off', 'glowcatch.music': 'on' }));
    expect([sound.music, sound.effects]).toEqual([true, false]);
  });

  it('stays silent and harmless before the first gesture', () => {
    const sound = createSound(memory());
    expect(sound.state).toBe('locked');
    expect(() => {
      sound.catch(caught);
      sound.tick();
      sound.roundEnd(true);
      sound.countdown(3);
      sound.countdown(0);
      sound.ambience(true);
      sound.ambience(false);
      sound.setMusic(false);
      sound.setEffects(false);
    }).not.toThrow();
  });

  it('does nothing on unlock where there is no Web Audio', () => {
    const sound = createSound(memory());
    sound.unlock();
    expect(sound.state).toBe('locked');
  });
});
