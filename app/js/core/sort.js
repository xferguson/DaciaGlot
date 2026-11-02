// Shared sort comparators. Pure.

/** Compare two strings by code unit order (the stable tie-break used across the app). */
export const cmpStr = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/** Comparator that orders items by the string `fn(item)`. */
export const byKey = (fn) => (a, b) => cmpStr(fn(a), fn(b));
