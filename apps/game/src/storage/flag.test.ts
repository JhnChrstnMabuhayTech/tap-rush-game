import { describe, expect, it } from 'vitest';
import { createFlag } from './flag';

const memory = () => {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

describe('createFlag', () => {
  it('starts unset, and is remembered once set', () => {
    const storage = memory();
    const flag = createFlag('glowcatch.howto', storage);
    expect(flag.get()).toBe(false);
    flag.set();
    expect(flag.get()).toBe(true);
    expect(createFlag('glowcatch.howto', storage).get()).toBe(true);
  });

  it('still works for the session when storage throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const flag = createFlag('glowcatch.howto', broken);
    expect(flag.get()).toBe(false);
    flag.set();
    expect(flag.get()).toBe(true);
  });
});
