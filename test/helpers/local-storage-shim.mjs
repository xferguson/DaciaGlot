/** In-memory localStorage for Node tests. `quota` limits the total chars stored. */
export function createLocalStorage({ quota = Infinity } = {}) {
  const map = new Map();
  const size = () => [...map].reduce((n, [k, v]) => n + k.length + v.length, 0);
  return {
    get length() { return map.size; },
    key: (i) => [...map.keys()][i] ?? null,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem(k, v) {
      v = String(v);
      const next = size() - (map.has(k) ? k.length + map.get(k).length : 0) + k.length + v.length;
      if (next > quota) {
        const e = new Error('The quota has been exceeded.');
        e.name = 'QuotaExceededError';
        e.code = 22;
        throw e;
      }
      map.set(k, v);
    },
    removeItem: (k) => { map.delete(k); },
    clear: () => map.clear(),
  };
}

/** Install a fresh shim on globalThis and return it. */
export function installLocalStorage(opts) {
  const ls = createLocalStorage(opts);
  Object.defineProperty(globalThis, 'localStorage', { value: ls, configurable: true, writable: true });
  return ls;
}
