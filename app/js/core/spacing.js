// Ordering a queue: spacing related cards apart, placing the immediate checks, re-queueing a wrong card (ARCHITECTURE §8). Pure.
import { buildCardId, unitIdOfFm } from "./cards.js";
import { pickIndex } from "./random.js";
import { unitId } from "./unit-id.js";
import { cardKeys } from "./due.js";

const SPACING_GAP = 2;
const SPACING_WINDOW = 8;

const overlaps = (a, b, skipNew = false) => {
  for (const k of a) if (b.has(k) && !(skipNew && k === "new")) return true;
  return false;
};

/**
 * Reorder a queue so related cards (same sentence or target lexeme, `cardKeys`) are at least
 * `SPACING_GAP` cards apart where the next `SPACING_WINDOW` cards allow it. Cards of the same
 * sentence keep their relative order (`lr` before its `cz`), and two new `lr` cards are kept apart.
 * Falls back to "not related to the previous card", then to the original order.
 */
export function spaceOut(queue, content) {
  const rest = queue.map((item) => ({ item, keys: cardKeys(item, content) }));
  const out = [];
  while (rest.length) {
    const recent = out.slice(-SPACING_GAP);
    const last = recent[recent.length - 1];
    const eligible = [];
    for (let i = 0; i < Math.min(rest.length, SPACING_WINDOW); i++) {
      const sk = [...rest[i].keys].find((k) => k.startsWith("s:"));
      if (sk && rest.slice(0, i).some((r) => r.keys.has(sk))) continue;
      eligible.push(i);
    }
    const pick = eligible.find((i) => recent.every((r, j) => !overlaps(rest[i].keys, r.keys, j < recent.length - 1)))
      ?? eligible.find((i) => !last || !overlaps(rest[i].keys, last.keys, true))
      ?? 0;
    out.push(rest.splice(pick, 1)[0]);
  }
  return out.map((r) => r.item);
}

/** FR-R2: a new sentence's one immediate check comes at least this many cards after its `lr` (or paradigm). */
export const CHECK_GAP = 8;

/**
 * FR-R2: place each new sentence's single immediate check (`check`, see `composeSession`) at least `CHECK_GAP`
 * cards after its `lr`/paradigm card and never next to another check where the queue allows it; a check that
 * can't get that far goes to the end. Other cards keep their order.
 */
export function placeChecks(queue) {
  const checks = queue.filter((q) => q.check);
  if (!checks.length) return queue;
  const out = queue.filter((q) => !q.check);
  const anchor = (c) => out.findIndex((q) => q.cardId === buildCardId("lr", c.from) || q.members?.includes(c.from));
  checks.sort((a, b) => anchor(a) - anchor(b));
  for (const c of checks) {
    const at = anchor(c);
    let i = at < 0 ? out.length : Math.min(out.length, at + 1 + CHECK_GAP);
    while (i < out.length && (out[i - 1]?.check || out[i]?.check)) i++;
    out.splice(i, 0, c);
  }
  return out;
}

/**
 * The blanks of an immediate check in its sentence: for each `fm` id (in `forms`), the first token carrying its unit.
 * Forms with no such token are left out. Pure.
 * @returns {{cardId: string, tokenIndex: number, presentedId: string}[]}
 */
export function checkBlanks(sentence, forms) {
  const out = [];
  for (const cardId of forms) {
    const unit = unitIdOfFm(cardId);
    const i = sentence.tokens.findIndex((t, j) => !out.some((b) => b.tokenIndex === j) && t.units.some((x) => unitId(x) === unit));
    if (i >= 0) out.push({ cardId, tokenIndex: i, presentedId: buildCardId("cz", sentence.id, i) });
  }
  return out.sort((a, b) => a.tokenIndex - b.tokenIndex);
}

/**
 * PRD FR-S9: re-queue a wrong card once, 3–5 cards later. With `content`, it moves up to 3 further
 * so it doesn't land next to a related card (`cardKeys`). Pure: returns `{queue, at}`, a new queue and the index it was inserted at.
 */
export function requeueWrong(queue, pos, item, rng, content) {
  let at = Math.min(queue.length, pos + 3 + pickIndex(rng, 3));
  if (content) {
    const keys = cardKeys({ cardId: item.cardId }, content);
    const clash = (i) => i >= 0 && i < queue.length && overlaps(keys, cardKeys(queue[i], content));
    for (let i = at; i <= Math.min(queue.length, at + 3); i++) {
      if (!clash(i - 1) && !clash(i)) { at = i; break; }
    }
  }
  const out = queue.slice();
  out.splice(at, 0, { cardId: item.cardId, isNew: false, requeued: true });
  return { queue: out, at };
}
