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
  it('is on by default', () => {
    expect(createSound(memory()).enabled).toBe(true);
  });

  it('remembers being muted', () => {
    const storage = memory();
    createSound(storage).setEnabled(false);
    expect(storage.data.get('glowcatch.sound')).toBe('off');
    expect(createSound(storage).enabled).toBe(false);
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
    }).not.toThrow();
  });

  it('does nothing on unlock where there is no Web Audio', () => {
    const sound = createSound(memory());
    sound.unlock();
    expect(sound.state).toBe('locked');
  });
});
