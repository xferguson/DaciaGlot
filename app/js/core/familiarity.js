// Familiarity credit (PRD FR-R7, ARCHITECTURE §8): words met in context wait a bit longer. Pure.
import { State } from "./fsrs.js";
import { partialCredit } from "./schedule.js";
import { fmIdForUnit } from "./cards.js";
import { dayKey } from "./time.js";
import { unitsForSentence } from "./units.js";
import { parseUnitId } from "./unit-id.js";

/** Share of a Medium step a word gets for being met: on screen in a correct card, or typed correctly but early. */
export const FAMILIARITY = { seen: 0.25, produced: 0.5 };

/**
 * Give each of `units` (form unit ids) a partial credit of `fraction`: claimed units, trivial lexemes (when `content` is
 * known), units already credited today and cards that aren't in Review state are skipped. Returns a new state (the same
 * one when nothing changed). `state.familiarity` maps unit → the local day it was credited and keeps today's entries only.
 */
export function creditUnits(state, units, fraction, now, content = null) {
  const today = dayKey(now);
  const claimed = state.claimed ?? {};
  const done = state.familiarity ?? {};
  let cards = null;
  let familiarity = null;
  for (const u of new Set(units)) {
    if (u.startsWith("pat:") || u in claimed || (familiarity ?? done)[u] === today) continue;
    if (content?.lexemes?.get(parseUnitId(u).lex)?.trivial) continue;
    const id = fmIdForUnit(u);
    const card = (cards ?? state.cards)[id];
    if (!card || card.state !== State.Review || card.lastReview == null) continue;
    cards ??= { ...state.cards };
    familiarity ??= Object.fromEntries(Object.entries(done).filter(([, d]) => d === today));
    cards[id] = partialCredit(card, fraction, now, state.calibration?.multiplier != null ? { multiplier: state.calibration.multiplier } : {});
    familiarity[u] = today;
  }
  return cards ? { ...state, cards, familiarity } : state;
}

/**
 * FR-R7: `sentence` was on screen in a correctly answered card (`kind` "seen"), or its early-typed words are credited
 * ("produced"). Every unit of the sentence not in `testedUnits` gets `creditUnits(..., FAMILIARITY[kind], ...)`.
 * `content` (optional) lets trivial lexemes be skipped. Returns a new state.
 */
export function exposureCredit(state, sentence, testedUnits, kind, now, content = null) {
  if (!sentence) return state;
  const tested = new Set(testedUnits);
  return creditUnits(state, unitsForSentence(sentence).filter((u) => !tested.has(u)), FAMILIARITY[kind], now, content);
}
