import { describe, expect, it } from 'vitest';
import { createBestStore } from './best';

const memory = (initial: Record<string, string> = {}) => {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
};

describe('createBestStore', () => {
  it('starts at 0 with nothing saved', () => {
    expect(createBestStore(memory()).get()).toBe(0);
  });

  it('reads the saved best', () => {
    expect(createBestStore(memory({ 'glowcatch.best': '42' })).get()).toBe(42);
  });

  it('ignores a value that is not a whole positive score', () => {
    expect(createBestStore(memory({ 'glowcatch.best': 'oops' })).get()).toBe(0);
    expect(createBestStore(memory({ 'glowcatch.best': '-3' })).get()).toBe(0);
  });

  it('records a higher score as the new best and saves it', () => {
    const storage = memory({ 'glowcatch.best': '40' });
    const store = createBestStore(storage);
    expect(store.record(55)).toEqual({ best: 55, isNewBest: true });
    expect(storage.data.get('glowcatch.best')).toBe('55');
    expect(store.get()).toBe(55);
  });

  it('keeps the best when a round scores lower or the same', () => {
    const store = createBestStore(memory({ 'glowcatch.best': '40' }));
    expect(store.record(40)).toEqual({ best: 40, isNewBest: false });
    expect(store.record(12)).toEqual({ best: 40, isNewBest: false });
  });

  it('never calls a zero a new best', () => {
    expect(createBestStore(memory()).record(0)).toEqual({ best: 0, isNewBest: false });
  });

  it('still works when storage is unavailable or throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
    };
    const store = createBestStore(broken);
    expect(store.get()).toBe(0);
    expect(store.record(9)).toEqual({ best: 9, isNewBest: true });
    expect(createBestStore(null).record(3)).toEqual({ best: 3, isNewBest: true });
  });
});
