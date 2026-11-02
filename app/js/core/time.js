// Local-day time helpers (ARCHITECTURE §8). Pure: `now` is passed in.

/** One day in milliseconds. */
export const DAY_MS = 86400000;

/** Local calendar day of `now` as `YYYY-MM-DD`. */
export function dayKey(now) {
  const d = new Date(now);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Local midnight `n` days after `now`'s local day (ms). `n = 0` is the start of `now`'s day. */
export function startOfDayPlus(now, n) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n).getTime();
}
