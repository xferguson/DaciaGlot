// Which cards are due, in focus and worth asking now: the review half of a session queue (ARCHITECTURE §8). Pure.
import { parseCardId, buildCardId, isCardType, unitIdOfFm, isUnlocked, isEasy } from "./cards.js";
import { unitsRequiredForCard } from "./units.js";
import { focusList } from "./select.js";
import { carriersFor, pickComposite } from "./carrier.js";
import { pickOne } from "./random.js";
import { isClaimedCard } from "./review.js";

/** Keys two cards share when they'd feel like a repeat: `s:<sentence>`, `l:<target lexeme>`; `new` marks a new `lr`. */
export function cardKeys(item, content) {
  const keys = new Set();
  if (item.members) { // a paradigm card (FR-R5)
    for (const m of item.members) keys.add(`s:${m}`);
    keys.add("new");
    return keys;
  }
  const p = parseCardId(item.cardId);
  if (p.type === "fm") {
    for (const f of content.familiesOfUnit?.get(unitIdOfFm(item.cardId)) ?? []) keys.add(`f:${f}`);
  }
  if (p.sentenceId) keys.add(`s:${p.sentenceId}`);
  if (item.from) keys.add(`s:${item.from}`);
  for (const { lx } of unitsRequiredForCard(item.cardId, content)) keys.add(`l:${lx}`);
  if (item.isNew && p.type === "lr") keys.add("new");
  return keys;
}

/** Due, unlocked, unclaimed cards whose sentence still exists, most overdue first. */
export function dueCards(state, content, now) {
  return Object.entries(state.cards)
    .filter(([id, c]) => c.due <= now && !isClaimedCard(id, state) && isUnlocked(id, state, content))
    .sort((a, b) => a[1].due - b[1].due || (a[0] < b[0] ? -1 : 1))
    .map(([id]) => id);
}

export function dueCount(state, content, now) {
  return dueCards(state, content, now).length;
}

/**
 * FR-S8: does the card's sentence belong to the focus? An `fm` card is in focus if any seen sentence it can be
 * shown in is. Legacy `kf` cards (no sentence) never are. No focus → true. `state` is only needed for `fm`.
 */
export function inFocus(cardId, focus, content, state = null) {
  const list = focusList(focus);
  if (!list.length) return true;
  const inList = (s) => !!s && list.some((f) => (f.type === "pattern" ? (s.patterns ?? []) : (s.situations ?? [])).includes(f.id));
  const p = parseCardId(cardId);
  if (p.type === "fm") {
    return !!state && carriersFor(unitIdOfFm(cardId), state, content).some((c) => inList(content.sentences.get(c.sentenceId)));
  }
  return inList(content.sentences.get(p.sentenceId));
}

/** Due cards, filtered to the focus when there is one (FR-S8). */
export function dueInFocus(state, content, now, focus) {
  return dueCards(state, content, now).filter((id) => inFocus(id, focus, content, state));
}

/** FR-S8: stable partition, cards whose sentence matches the focus first. `kf` cards have no sentence and keep their place after. */
export function focusFirst(cardIds, focus, content, state = null) {
  if (!focusList(focus).length) return cardIds;
  const hit = (id) => inFocus(id, focus, content, state);
  const flags = cardIds.map(hit);
  return [...cardIds.filter((_, i) => flags[i]), ...cardIds.filter((_, i) => !flags[i])];
}

/**
 * FR-R2: keep at most one due card per sentence and per head lexeme (`cardKeys` `s:`/`l:`), in the order given
 * (most overdue first). The buried cards stay due and come up in a later session.
 */
export function burySiblings(cardIds, content) {
  const taken = new Set();
  return cardIds.filter((cardId) => {
    const keys = [...cardKeys({ cardId }, content)].filter((k) => k !== "new");
    if (keys.some((k) => taken.has(k))) return false;
    for (const k of keys) taken.add(k);
    return true;
  });
}

/**
 * FR-R5: of the due `fm` cards whose forms vary inside one family, keep one at random and leave the rest due for
 * another session. Other cards, and `fm` cards of no family, pass through in their order.
 */
export function onePerFamily(cardIds, content, rng) {
  const byFamily = new Map();
  cardIds.forEach((id, i) => {
    if (!isCardType(id, "fm")) return;
    const f = content.familiesOfUnit?.get(unitIdOfFm(id))?.[0];
    if (!f) return;
    if (!byFamily.has(f)) byFamily.set(f, []);
    byFamily.get(f).push(i);
  });
  const drop = new Set();
  for (const idx of byFamily.values()) {
    if (idx.length < 2) continue;
    const keep = pickOne(idx, rng);
    for (const i of idx) if (i !== keep) drop.add(i);
  }
  return cardIds.filter((_, i) => !drop.has(i));
}

/**
 * FR-V1 (T32): the due `fm` cards of easy forms are replaced by composite `er` items, greedily, until no composite
 * of ≥ 2 forms is left; the rest stay single reviews. A composite sits where its first form was and drops a due
 * `er:<sid>` for the same sentence (the composite is that review). Returns the new id list and `sid → units`.
 */
export function composeReviews(ids, state, content, now, rng, focus = null) {
  const easy = ids.filter((id) => isCardType(id, "fm") && isEasy(state, unitIdOfFm(id)));
  const left = new Set(easy.map(unitIdOfFm));
  const exclude = new Set();
  const comps = new Map(); // sentenceId → units
  const owner = new Map(); // unit → sentenceId
  const allow = focus ? (sid) => inFocus(buildCardId("er", sid), focus, content, state) : null;
  for (;;) {
    const pick = pickComposite([...left], state, content, now, rng, { exclude, allow });
    if (!pick) break;
    comps.set(pick.sentenceId, pick.units);
    exclude.add(pick.sentenceId);
    for (const u of pick.units) { left.delete(u); owner.set(u, pick.sentenceId); }
  }
  const out = [];
  const emitted = new Set();
  for (const id of ids) {
    if (isCardType(id, "er") && comps.has(parseCardId(id).sentenceId)) continue;
    const sid = isCardType(id, "fm") ? owner.get(unitIdOfFm(id)) : null;
    if (!sid) { out.push(id); continue; }
    if (!emitted.has(sid)) { emitted.add(sid); out.push(buildCardId("er", sid)); }
  }
  return { ids: out, comps };
}
