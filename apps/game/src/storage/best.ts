// The player's best score on this device, so the title can show it the moment
// it renders. (Facebook's player data and the server's best come later; the
// design keeps the highest of them: decision D8.)

const KEY = 'glowcatch.best';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export interface BestRecord {
  /** The best after this round, this round included. */
  best: number;
  isNewBest: boolean;
}

export function createBestStore(storage: Store | null = deviceStorage()) {
  let best = read();

  function read(): number {
    try {
      const value = Number(storage?.getItem(KEY));
      return Number.isInteger(value) && value > 0 ? value : 0;
    } catch {
      return 0;
    }
  }

  return {
    /** 0 when there's no best yet: the title then shows no Best chip, never "Best 0". */
    get: () => best,
    record(score: number): BestRecord {
      if (score <= best) return { best, isNewBest: false };
      best = score;
      try {
        storage?.setItem(KEY, String(score));
      } catch {
        // Private mode or storage full: the best still holds for this session.
      }
      return { best, isNewBest: true };
    },
  };
}

function deviceStorage(): Store | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
