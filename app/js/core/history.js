// Per-day history (ARCHITECTURE §4.2, §8). Pure: `now` is passed in.
import { dayKey } from "./time.js";

/** A day record with every counter at zero. The one place a new DayStats field is added. */
export function emptyDay() {
  return { minutes: 0, cards: 0, newSentences: 0, formsProduced: 0, newItems: 0 };
}

/** New history with `fn` applied to a copy of `now`'s day record (created empty if missing). */
export function bumpDay(history, now, fn) {
  const key = dayKey(now);
  const day = { ...emptyDay(), ...history[key] };
  fn(day);
  return { ...history, [key]: day };
}

/** State with `minutes` added to `now`'s day. */
export function addMinutes(state, minutes, now) {
  return { ...state, history: bumpDay(state.history, now, (d) => { d.minutes += minutes; }) };
}
