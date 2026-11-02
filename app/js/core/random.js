// Shared randomness helpers. Pure: the caller passes `rng` (a function returning a number in [0, 1)); it is required
// (calling without one throws a TypeError at the first rng() call, exactly as the hand-written code it replaced).

/** A random index in [0, n): `floor(rng() * n)`, clamped to `n - 1`. One `rng()` call. */
export function pickIndex(rng, n) {
  return Math.min(n - 1, Math.floor(rng() * n));
}

/** A random element of `arr` (at `pickIndex`). One `rng()` call. */
export function pickOne(arr, rng) {
  return arr[pickIndex(rng, arr.length)];
}

/** Fisher–Yates. Returns a shuffled copy; `arr` is not mutated. `arr.length - 1` `rng()` calls, last index first. */
export function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = pickIndex(rng, i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
