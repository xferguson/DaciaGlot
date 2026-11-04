// Priming guard (PRD FR-S14, ARCHITECTURE §8): don't test a word that was on screen a few cards ago. Pure.
import { parseCardId } from "./cards.js";
import { unitsRequiredForCard, unitsForSentence } from "./units.js";
import { isPatternUnit } from "./unit-id.js";
import { cardKeys } from "./due.js";

export { PRIMED_CREDIT } from "./schedule.js";

/** How far ahead `deferPrimed` looks for an unprimed card (the same window as `spaceOut`). */
export const PRIMING_WINDOW = 8;

const lexUnits = (units) => units.filter((u) => !isPatternUnit(u));

/**
 * Every word-form unit (`<lex>.<form>`) a card puts on screen: its own sentence, the `options` of an `lr` card
 * (sentences), and every member of a paradigm card. `item` is the queue item.
 * @returns {Set<string>}
 */
export function shownUnits(item, sentence, content, options = []) {
  const out = new Set();
  const sentences = [sentence, ...options];
  for (const m of item?.members ?? []) sentences.push(content.sentences.get(m));
  for (const s of sentences) if (s) for (const u of lexUnits(unitsForSentence(s))) out.add(u);
  return out;
}

/**
 * Does the card test a unit that an earlier card of this session already showed (`shown`, a Set of unit ids)?
 * `lr` cards, paradigms, immediate checks and re-queued wrong cards are never primed: they are meant to come soon.
 */
export function isPrimed(item, shown, content) {
  if (!item || item.check || item.members || item.requeued) return false;
  if (parseCardId(item.cardId).type === "lr") return false;
  const units = item.composite ? item.units : unitsRequiredForCard(item.cardId, content).map(({ u }) => u);
  return lexUnits(units ?? []).some((u) => shown.has(u));
}

const overlaps = (a, b) => [...a].some((k) => b.has(k));

/**
 * Called before showing `queue[pos]`. A primed card is swapped with the first unprimed card in the next
 * `PRIMING_WINDOW`; if none is free it is taken out of the session (`deferred`, it stays due) unless it is the last
 * card left. Repeats until `queue[pos]` is unprimed. Never moves a card before an earlier card of its own sentence.
 * @returns {{queue: object[], deferred: object[]}} a new queue; the input is not mutated
 */
export function deferPrimed(queue, pos, shown, content) {
  let out = queue;
  const deferred = [];
  while (pos < out.length && isPrimed(out[pos], shown, content)) {
    let swap = -1;
    for (let j = pos + 1; j < Math.min(out.length, pos + 1 + PRIMING_WINDOW); j++) {
      const c = out[j];
      if (c.check || isPrimed(c, shown, content)) continue;
      const keys = cardKeys(c, content);
      if (out.slice(pos, j).some((q) => overlaps(cardKeys(q, content), new Set([...keys].filter((k) => k.startsWith("s:")))))) continue;
      swap = j;
      break;
    }
    out = out.slice();
    if (swap >= 0) [out[pos], out[swap]] = [out[swap], out[pos]];
    else if (out.length - pos > 1) deferred.push(...out.splice(pos, 1));
    else break; // the only card left: shown anyway, with partial credit
  }
  return { queue: out, deferred };
}
