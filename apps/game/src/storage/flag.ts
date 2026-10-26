// A one-way flag remembered on the device, such as "has seen How to play".
// Safe when storage is blocked: it then lasts for the session.

type Store = Pick<Storage, 'getItem' | 'setItem'>;

export function createFlag(key: string, storage: Store | null = deviceStorage()) {
  let value = read();

  function read(): boolean {
    try {
      return storage?.getItem(key) === 'yes';
    } catch {
      return false;
    }
  }

  return {
    get: () => value,
    set() {
      value = true;
      try {
        storage?.setItem(key, 'yes');
      } catch {
        // Not remembered, but still set for this session.
      }
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
