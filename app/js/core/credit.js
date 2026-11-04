// Credit for words produced correctly inside a bigger card (PRD FR-R7, ARCHITECTURE §8). Pure.
import { State } from "./fsrs.js";
import { scheduleCard } from "./schedule.js";
import { fmIdForUnit } from "./cards.js";

/** A card is "on time" for credit once this share of its current gap has passed since its last review. */
export const ON_TIME_SHARE = 0.5;

/**
 * FR-R7: the learner produced `okUnits` (unit ids) correctly in an `er`, `xf` or `sb` card. Each unit whose `fm` card is
 * in Review state and on time (>= 50 % of its gap since the last review) gets a full review at `grade`; early ones are
 * left alone. Claimed units are skipped. Returns a new state (the same one when nothing changed).
 */
export function creditProduced(state, okUnits, grade, now) {
  const claimed = state.claimed ?? {};
  const multiplier = state.calibration?.multiplier;
  let cards = null;
  for (const u of new Set(okUnits)) {
    if (u in claimed) continue;
    const id = fmIdForUnit(u);
    const card = (cards ?? state.cards)[id];
    if (!card || card.state !== State.Review || card.lastReview == null) continue;
    const gap = card.due - card.lastReview;
    if (now - card.lastReview < ON_TIME_SHARE * gap) continue; // T39: partial credit here
    cards ??= { ...state.cards };
    cards[id] = scheduleCard(card, grade, now, ...(multiplier != null ? [{ multiplier }] : []));
  }
  return cards ? { ...state, cards } : state;
}
