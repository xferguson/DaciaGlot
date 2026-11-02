// Session building, grading and review application (ARCHITECTURE §8). Pure: `now` and `rng` are injected.
import { newCard, review } from "./fsrs.js";
import { parseCardId, buildCardId, isCardType, unitIdOfFm, fmIdForUnit, cardsForSentence, isUnlocked, isEasy, newKfCards, newTransformCards, newErCards, pickPerSentence } from "./cards.js";
import { unitsForSentence, isKnown, unitsRequiredForCard } from "./units.js";
import { pickNewSentences, focusList, siblingsOf, newItemCount, isFastTrackUnit } from "./select.js";
import { carriersFor, pickComposite } from "./carrier.js";
import { learnBatch } from "./pace.js";
import { pickIndex, pickOne } from "./random.js";
import { DAY_MS, dayKey, startOfDayPlus } from "./time.js";
import { unitId, parseUnitId } from "./unit-id.js";
import { bumpDay, addMinutes } from "./history.js";

export { dayKey, addMinutes };

export const QUICK_CAP = 15;
export const SEC_PER_REVIEW = 12;
export const SEC_PER_NEW = 40;
/** T33: a new sentence in Learn mode (fast `lr`, one tap) including its share of the combined check. */
export const SEC_PER_NEW_FAST = 25;
/** Mix never drops below this many new sentences because of reviews; the review part is trimmed instead (T33). */
export const MIX_MIN_NEW = 3;
/** Mix aims for a session of about this long: due reviews first, new sentences fill what's left. */
export const MIX_BUDGET_SEC = 12 * 60;
/** With a focus, Mix also brings in up to this many of the most overdue cards from outside it (FR-S8). */
export const MIX_OUTSIDE = 3;
/** Below this many seen sentences, new sessions top up with the easiest sentences (FR-S4 order) when i+1 finds too few. */
export const COLD_START_SEEN = 30;
/** A new sentence costs `SEC_PER_NEW` for one `lr` plus one new form to check; each form more (or fewer) scales it (FR-R2). */
export const newSentenceSec = (forms, perNew = SEC_PER_NEW) => (perNew * (1 + forms)) / 2;
/** Each extra member of a paradigm card adds this much reading time to the estimate. */
const SEC_PER_PARADIGM_ROW = 10;
const SPACING_GAP = 2;
const SPACING_WINDOW = 8;

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

/** Start of the local day after `now` (ms): the earliest a form's first counted test is due (FR-R2). */
export const nextDayStart = (now) => startOfDayPlus(now, 1);

/** FR-V3: the rung a transparent form's first right check lands on. */
export const FAST_TRACK_DAYS = 4;

/**
 * Leaving a session early: new `fm` cards of a sentence that was already introduced (its `lr` reviewed, `from`) but
 * whose immediate check wasn't reached are created as new cards due the next local day, with no check (FR-R2).
 * `remaining` is the rest of the queue. Returns a new state.
 */
export function keepStarted(state, remaining, now) {
  const cards = { ...state.cards };
  for (const { cardId: id, isNew, from, forms } of remaining) {
    if (!isNew || isCardType(id, "pg")) continue;
    for (const cardId of forms ?? [id]) {
      if (cardId in cards) continue;
      const p = parseCardId(cardId);
      if (p.type === "fm" && from && buildCardId("lr", from) in cards) cards[cardId] = { ...newCard(now), due: nextDayStart(now) };
    }
  }
  return { ...state, cards };
}

/** FR-S9: a card struggled with (Hard or wrong) twice in one session goes on the difficult list. */
export function markDifficult(state, cardId, now) {
  return { ...state, difficult: { ...state.difficult, [cardId]: now } };
}

/**
 * Mix mode: how many new sentences to add given the review load. All due cards stay in; new
 * sentences fill the rest of `MIX_BUDGET_SEC`, at most `newPerSession`, but never fewer than `MIX_MIN_NEW`
 * (or `newPerSession` if lower): once reviews fill the budget they are trimmed instead (T33).
 * `reviewPct` is the review share of the estimated time.
 * @returns {{newCount: number, reviewPct: number}}
 */
export function mixPlan(due, newPerSession) {
  const room = Math.floor((MIX_BUDGET_SEC - due * SEC_PER_REVIEW) / SEC_PER_NEW);
  const newCount = Math.max(Math.min(MIX_MIN_NEW, newPerSession), Math.min(newPerSession, room));
  const total = due * SEC_PER_REVIEW + newCount * SEC_PER_NEW;
  return { newCount, reviewPct: total ? Math.round((100 * due * SEC_PER_REVIEW) / total) : 0 };
}

/**
 * Learn mode (T33): new sentences until their new-item count reaches `settings.newItemsPerLearn`
 * (paradigm batches count each member's new forms). Same result shape as `pickNewSentences`, plus `items`.
 */
export function learnPlan(state, content, focus, now, rng) {
  const items = learnBatch(state);
  return pickNewSentences(Infinity, { focus, state, content, now, rng, items });
}

/** PRD FR-S1: Medium (Good) climbs this ladder of gaps, in days, and stays on the top rung. */
export const MEDIUM_LADDER_DAYS = [1, 4, 16, 64, 256];
/** Easy waits this many times Medium's next gap (capped at the top rung). */
export const EASY_FACTOR = 3;

/**
 * Days until the next review for a Medium (3) or Easy (4) answer, given the card's previous scheduled gap
 * in days (0 for a new card): the first rung above it, × `EASY_FACTOR` for Easy. Hard and Again keep FSRS.
 */
export function ladderDays(prevDays, grade) {
  const top = MEDIUM_LADDER_DAYS[MEDIUM_LADDER_DAYS.length - 1];
  const medium = MEDIUM_LADDER_DAYS.find((d) => d > prevDays + 1e-6) ?? top;
  return grade === 4 ? Math.min(top, medium * EASY_FACTOR) : medium;
}

/** PRD FR-S2. `rating` ("hard"|"medium"|"easy") is the learner's self-rating after a clean correct answer. */
export function gradeFromResult({ result, usedHint = false, attemptNo = 1, rating = null, tooEasy = false }) {
  if (result === "wrong") return 1;
  if (usedHint || attemptNo > 1) return 2;
  if (rating === "hard") return 2;
  return rating === "easy" || tooEasy ? 4 : 3;
}

/** Is this `fm` card's form claimed ("I can produce this", FR-R4)? Claimed forms are never tested. */
const isClaimedCard = (cardId, state) => isCardType(cardId, "fm") && unitIdOfFm(cardId) in (state.claimed ?? {});

/** FR-R4: claim a lexeme-form unit (`<lex>.<form>`) as producible. Its `fm` card, if any, stays as it is. Returns a new state. */
export function claimForm(state, unit, now) {
  return { ...state, claimed: { ...state.claimed, [unit]: now } };
}

/** Undo a claim: its `fm` card (suspended while claimed) is active again with its old schedule. Returns a new state. */
export function unclaimForm(state, unit, _now) {
  const { [unit]: _gone, ...claimed } = state.claimed ?? {};
  return { ...state, claimed };
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

/** PRD FR-S4 interim order: stage ↑, fewest unknown units ↑, id. */
export function interimNewSentences(n, state, content) {
  const registers = state.settings.registers;
  return [...content.sentences.values()]
    .filter((s) => !(s.id in state.seenSentences) && registers.includes(s.register))
    .map((s) => ({ s, unknown: unitsForSentence(s).filter((u) => !isKnown(u, state, content)).length }))
    .sort((a, b) => a.s.stage - b.s.stage || a.unknown - b.unknown || (a.s.id < b.s.id ? -1 : 1))
    .slice(0, n)
    .map((x) => x.s.id);
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

/** One check item per new sentence: all its new forms, blanked together in one card. */
function oneCheck(fmIds, from) {
  return fmIds.length ? [{ cardId: fmIds[0], isNew: true, from, check: true, forms: fmIds }] : [];
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

function chunk(list, parts) {
  const out = Array.from({ length: parts }, () => []);
  list.forEach((x, i) => out[Math.min(parts - 1, Math.floor((i * parts) / list.length))].push(x));
  return out;
}

/**
 * Modes (PRD FR-S6, FR-S7, FR-S10):
 * - `quick`: due cards only, capped at 15.
 * - `review`: every due card, nothing new.
 * - `learn`: new material only (no due cards): `newItemsPerLearn` new items (`learnPlan`) plus newly unlocked drills.
 * - `mix`: all due cards plus as many new sentences as `mixPlan` allows; no new drills when it allows none.
 * - `session` (legacy): all due cards plus `newPerSession` new sentences.
 * Any mode takes a `focus` (one topic or a list), which filters everything to those situations/patterns
 * (FR-S8): due cards, new sentences and drills; `kf` cards are left out. Mix with a focus also adds the
 * `MIX_OUTSIDE` most overdue cards from outside it.
 * A new profile (< `COLD_START_SEEN` seen sentences) is topped up to the wanted number of new sentences.
 * The queue is then spaced out (`spaceOut`) so related cards are not back to back.
 * New sentences (`lr`, then `cz`) are chosen by `select.js` (FR-S5; the FR-S4 interim order is the cold-start fallback), spread so two new sentences' `lr` cards are never adjacent, then newly unlocked `kf` (T14), `xf`/`sb` (T15) and `er` (T20) cards. Due cards are thinned per sentence (FR-D9).
 * @returns {{queue: {cardId: string, isNew: boolean}[], estimateSec: number, blocked?: true, suggest?: {type: string, id: string}|null, plan?: {newCount: number, reviewPct: number}}}
 */
export function buildSession(opts) {
  const out = composeSession(opts);
  return { ...out, queue: placeChecks(spaceOut(out.queue, opts.content)) };
}

/** Seconds one queue item takes: a composite review (FR-V1) is a whole sentence, so twice a single card. */
const itemSec = (q) => (q.composite ? 2 : 1) * SEC_PER_REVIEW;

/**
 * FR-V1 (T32): the due `fm` cards of easy forms are replaced by composite `er` items, greedily, until no composite
 * of ≥ 2 forms is left; the rest stay single reviews. A composite sits where its first form was and drops a due
 * `er:<sid>` for the same sentence (the composite is that review). Returns the new id list and `sid → units`.
 */
export function composeReviews(ids, state, content, now, rng, focus = null) {
  const easy = ids.filter((id) => isCardType(id, "fm") && isEasy(state, unitIdOfFm(id), now));
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

function composeSession({ mode, focus: rawFocus = null, state, content, now, rng, newSentenceIds }) {
  const focus = focusList(rawFocus).length ? focusList(rawFocus) : null;
  let focused = dueInFocus(state, content, now, focus);
  if (focus && mode === "mix") {
    const outside = dueCards(state, content, now).filter((id) => !inFocus(id, focus, content, state)).slice(0, MIX_OUTSIDE);
    focused = [...focused, ...outside];
  }
  const duePicked = pickPerSentence(focused);
  const { ids: composed, comps } = composeReviews(onePerFamily(duePicked, content, rng), state, content, now, rng, focus);
  const dueIds = burySiblings(composed, content);
  const allDue = dueIds.map((cardId) => {
    const units = isCardType(cardId, "er") ? comps.get(parseCardId(cardId).sentenceId) : null;
    return units ? { cardId, isNew: false, composite: true, units } : { cardId, isNew: false };
  });
  const dueSec = (items) => items.reduce((n, q) => n + itemSec(q), 0);
  if (mode === "quick" || mode === "review") {
    const queue = mode === "quick" ? allDue.slice(0, QUICK_CAP) : allDue;
    return { queue, estimateSec: dueSec(queue) };
  }
  let due = mode === "learn" ? [] : allDue;
  let plan = mode === "mix" ? mixPlan(dueSec(due) / SEC_PER_REVIEW, state.settings.newPerSession) : null;
  if (plan) {
    // T33: new material has a floor; the review part is trimmed to what is left of the budget (oldest-due stay).
    const left = MIX_BUDGET_SEC - plan.newCount * SEC_PER_NEW;
    let used = 0;
    const kept = [];
    for (const q of due) {
      if (used + itemSec(q) > left) break;
      used += itemSec(q);
      kept.push(q);
    }
    if (kept.length < due.length) {
      due = kept;
      plan = mixPlan(dueSec(due) / SEC_PER_REVIEW, state.settings.newPerSession);
    }
  }
  if (plan && plan.newCount === 0 && !newSentenceIds) {
    return { queue: due, estimateSec: dueSec(due), plan };
  }
  const learn = mode === "learn";
  const want = plan ? plan.newCount : learn ? learnBatch(state) : state.settings.newPerSession;
  let ids = newSentenceIds;
  if (!ids) {
    const pick = learn ? learnPlan(state, content, focus, now, rng) : pickNewSentences(want, { focus, state, content, now, rng });
    if (pick.blocked) {
      const queue = due.slice();
      return { queue, estimateSec: dueSec(queue), blocked: true, suggest: pick.suggest };
    }
    ids = pick.sentences.length || focus ? pick.sentences : interimNewSentences(want, state, content);
    const have0 = learn ? newItemCount(ids, state, content) : ids.length;
    if (have0 < want && Object.keys(state.seenSentences).length < COLD_START_SEEN) {
      // New profile: i+1 finds few sentences yet, so top up with the easiest ones (FR-S4 order).
      const have = new Set(ids);
      const extra = interimNewSentences(Infinity, state, content)
        .filter((id) => !have.has(id) && inFocus(buildCardId("lr", id), focus, content, state))
        .slice(0, want - have0);
      ids = [...ids, ...extra];
    }
  }
  // One schedule per word form: a form shared by two new sentences gets its `fm` card from the first.
  const claimed = new Set();
  const newFms = (s) => cardsForSentence(s, content, state)
    .filter((cardId) => isCardType(cardId, "fm") && !isClaimedCard(cardId, state) && !claimed.has(cardId) && claimed.add(cardId));
  const grouped = new Set(ids);
  const groups = ids
    .map((id) => content.sentences.get(id))
    .filter(Boolean)
    .map((s) => {
      const sibs = siblingsOf(s.id, { state, content }).filter((m) => !grouped.has(m));
      if (!sibs.length) {
        const ids = cardsForSentence(s, content, state)
          .filter((cardId) => !isClaimedCard(cardId, state) && !claimed.has(cardId) && claimed.add(cardId));
        return [
          ...ids.filter((cardId) => !isCardType(cardId, "fm")).map((cardId) => ({ cardId, isNew: true })),
          ...oneCheck(ids.filter((cardId) => isCardType(cardId, "fm")), s.id),
        ];
      }
      // A paradigm (FR-R5): one card for the family, one immediate check on a random member, the rest due tomorrow.
      sibs.forEach((m) => grouped.add(m));
      const members = [s.id, ...sibs];
      const chosen = content.sentences.get(pickOne(members, rng));
      const checks = newFms(chosen);
      const deferred = members.flatMap((m) => (m === chosen.id ? [] : newFms(content.sentences.get(m))));
      return [
        { cardId: buildCardId("pg", content.familyOf.get(s.id)), isNew: true, members, deferred },
        ...oneCheck(checks, chosen.id),
      ];
    });
  const k = groups.length;
  const kf = focus ? [] : newKfCards(state, content).filter((id) => !claimed.has(id) && !isClaimedCard(id, state)).map((cardId) => ({ cardId, isNew: true }));
  const queue = [];
  if (k === 0) queue.push(...due);
  else {
    const slots = chunk(due, 2 * k + 1);
    queue.push(...slots[0]);
    groups.forEach((g, i) => {
      queue.push(g[0], ...slots[2 * i + 1], ...g.slice(1), ...slots[2 * i + 2]);
    });
  }
  const busy = new Set(duePicked.map(parseCardId).filter((p) => p.type === "xf" || p.type === "sb").map((p) => p.sentenceId));
  const xf = newTransformCards(state, content, { skip: busy }).filter((id) => inFocus(id, focus, content, state)).map((cardId) => ({ cardId, isNew: true }));
  const taken = new Set([...busy, ...xf.map((x) => parseCardId(x.cardId).sentenceId)]);
  const er = newErCards(state, content, { skip: taken }).filter((id) => inFocus(id, focus, content, state)).map((cardId) => ({ cardId, isNew: true }));
  queue.push(...kf, ...xf, ...er);
  const estimateSec = dueSec(due) + (kf.length + xf.length + er.length) * SEC_PER_NEW
    + groups.reduce((sum, g) => sum + newSentenceSec(g.reduce((n, q) => n + (q.forms?.length ?? 0), 0), learn ? SEC_PER_NEW_FAST : SEC_PER_NEW) + (g[0].members ? SEC_PER_PARADIGM_ROW * (g[0].members.length - 1) : 0), 0);
  return plan ? { queue, estimateSec, plan } : { queue, estimateSec };
}

/** The `seenSentences` and `lexemeSentences` after the learner has met a sentence (`lr`, or a composite `er`). */
function exposure(state, sentenceId, now, content) {
  const out = {};
  if (!(sentenceId in state.seenSentences)) out.seenSentences = { ...state.seenSentences, [sentenceId]: now };
  const sentence = content?.sentences.get(sentenceId);
  if (sentence) {
    const ls = { ...state.lexemeSentences };
    for (const t of sentence.tokens) {
      for (const u of t.units) {
        const cur = ls[u.lex] ?? [];
        if (!cur.includes(sentenceId)) ls[u.lex] = [...cur, sentenceId];
      }
    }
    out.lexemeSentences = ls;
  }
  return out;
}

/**
 * One review of a card: FSRS keeps stability/difficulty (mastery reads them); from Good up the gap itself follows the
 * ladder (FR-S1). `lastGrade` records the grade for `isEasy` (FR-V1). `prev` may be undefined (a new card).
 */
function scheduleCard(prev, grade, now) {
  let card = review(prev ?? newCard(now), grade, now);
  if (grade >= 3) {
    const prevDays = prev?.lastReview != null ? Math.max(0, prev.due - prev.lastReview) / DAY_MS : 0;
    card = { ...card, due: now + ladderDays(prevDays, grade) * DAY_MS };
  }
  return { ...card, lastGrade: grade };
}

/**
 * FSRS update (Medium/Easy gaps from `ladderDays`), attempts (production cards only, PRD FR-S3), `lr` exposure, day stats.
 * `unitsRequired` is `{u, lx}[]` from `unitsRequiredForCard`. `content` is only needed for `lr` exposure.
 * For an `fm` card, `presentedId` is the id it was shown as (`cz:<sid>:<i>` or `kf:<lex>:<form>`), recorded on the attempts; `unitsRequired` comes from it.
 * Returns a new state; the input is not mutated.
 */
export function applyReview(state, cardId, grade, unitsRequired, now, content, presentedId = cardId) {
  const p = parseCardId(cardId);
  const card = scheduleCard(state.cards[cardId], grade, now);
  const next = { ...state, cards: { ...state.cards, [cardId]: card } };
  let isNewSentence = false;
  if (p.type === "lr") {
    isNewSentence = !(p.sentenceId in state.seenSentences);
    Object.assign(next, exposure(state, p.sentenceId, now, content));
  } else {
    // FR-R4, evidence wins: a missed EN→RO card takes back the claims on the forms it tested.
    if (p.type === "er" && grade === 1 && unitsRequired.some(({ u }) => u in (state.claimed ?? {}))) {
      next.claimed = Object.fromEntries(Object.entries(state.claimed).filter(([u]) => !unitsRequired.some((r) => r.u === u)));
    }
    next.attempts = [
      ...state.attempts,
      ...unitsRequired.map(({ u, lx }) => ({ u, lx, c: grade >= 2 ? 1 : 0, t: now, card: presentedId })),
    ];
  }
  next.history = bumpDay(state.history, now, (d) => {
    d.cards += 1;
    if (isNewSentence) d.newSentences += 1;
  });
  return next;
}

/**
 * FR-D6: which cloze units an EN→RO answer got right and wrong, from the `checkAnswer` diff. A unit is missed when any
 * token carrying it is `wrong`/`missing`. Null when the diff doesn't line up with the sentence's tokens (an `accept`
 * alternative with another token count), so the caller grades the whole card instead.
 * @returns {{missed: string[], ok: string[], missedTokens: string[]} | null}
 */
export function erMisses(sentence, diff) {
  if (!diff || diff.length !== sentence.tokens.length) return null;
  const missed = new Set();
  const seen = new Set();
  const missedTokens = [];
  sentence.tokens.forEach((t, i) => {
    if (!t.cloze) return;
    const bad = diff[i].status === "wrong" || diff[i].status === "missing";
    if (bad) missedTokens.push(t.t.replace(/[.,!?;:]+$/, ""));
    for (const u of t.units) {
      const id = unitId(u);
      seen.add(id);
      if (bad) missed.add(id);
    }
  });
  return { missed: [...missed], ok: [...seen].filter((u) => !missed.has(u)), missedTokens };
}

/**
 * FR-D6/FR-S3: review an `er` card with part-level credit. The card itself is graded as `applyReview` does. Units of
 * missed tokens get a `c: 0` attempt and their `fm` card Again (created due now if it doesn't exist; a claim on it is
 * dropped); units of correct tokens get `c: 1` and keep their `fm` schedule. `misses` is `erMisses(...)`; without it
 * the whole card is graded.
 *
 * `composite` (FR-V1, T32) is the list of due easy unit ids the card was built to review. Those that were answered
 * correctly are reviewed on their own `fm` card too (Good, Easy when the learner rated Easy, Hard after a hint or
 * retry); without `misses` a wrong card fails them all and any other grade passes them all. A composite on an
 * unseen sentence also marks it seen. Returns a new state.
 */
export function applyErReview(state, cardId, grade, unitsRequired, misses, now, content, presentedId = cardId, composite = null) {
  if (composite && !misses) {
    misses = grade === 1 ? { missed: [...composite], ok: [], missedTokens: [] } : { missed: [], ok: [...composite], missedTokens: [] };
  }
  if (!misses) return applyReview(state, cardId, grade, unitsRequired, now, content, presentedId);
  const clozeIds = new Set([...misses.missed, ...misses.ok]);
  const rest = unitsRequired.filter(({ u }) => !clozeIds.has(u));
  let next = applyReview(state, cardId, grade, rest, now, content, presentedId);
  if (composite) Object.assign(next, exposure(next, parseCardId(cardId).sentenceId, now, content));
  const lxOf = new Map(unitsRequired.map(({ u, lx }) => [u, lx]));
  const missedSet = new Set(misses.missed);
  const cards = { ...next.cards };
  for (const u of misses.missed) {
    const id = fmIdForUnit(u);
    cards[id] = cards[id] ? { ...review(cards[id], 1, now), lastGrade: 1 } : { ...newCard(now), lastGrade: 1 };
  }
  const okGrade = grade >= 3 ? grade : grade === 2 ? 2 : 3;
  for (const u of composite ?? []) {
    if (missedSet.has(u) || !clozeIds.has(u)) continue;
    cards[fmIdForUnit(u)] = scheduleCard(cards[fmIdForUnit(u)], okGrade, now);
  }
  const claimed = Object.fromEntries(Object.entries(next.claimed ?? {}).filter(([u]) => !missedSet.has(u)));
  const attempts = [
    ...next.attempts,
    ...[...misses.missed, ...misses.ok].map((u) => ({ u, lx: lxOf.get(u) ?? parseUnitId(u).lex, c: missedSet.has(u) ? 0 : 1, t: now, card: presentedId })),
  ];
  return { ...next, cards, claimed, attempts };
}

/**
 * FR-R5: the learner has gone through a paradigm card. Every member counts as seen (as `lr` does, as one card in the
 * day's count), and the forms of the members that get no immediate check become `fm` cards due the next local day.
 * `item` is the queue item (`{members, deferred}`). Returns a new state.
 */
export function applyParadigm(state, item, now, content) {
  let next = state;
  for (const m of item.members) next = applyReview(next, buildCardId("lr", m), 3, [], now, content);
  const cards = { ...next.cards };
  for (const id of item.deferred ?? []) if (!(id in cards)) cards[id] = { ...newCard(now), due: nextDayStart(now) };
  const extra = item.members.length - 1;
  return { ...next, cards, history: bumpDay(next.history, now, (d) => { d.cards -= extra; }) };
}

/**
 * FR-R2: the immediate check of a new form. Records `enc` attempts (ignored by mastery and `isKnown`) and, if the
 * `fm` card doesn't exist yet, creates it due the next local day whatever the answer; no FSRS review, no rating.
 * Exception (FR-V3, needs `content`): a right check on a transparent form outside divergent slots creates it due in `FAST_TRACK_DAYS`.
 * Returns a new state; the input is not mutated.
 */
export function applyCheck(state, cardId, correct, unitsRequired, now, presentedId = cardId, content = null) {
  const next = {
    ...state,
    attempts: [
      ...state.attempts,
      ...unitsRequired.map(({ u, lx }) => ({ u, lx, c: correct ? 1 : 0, t: now, card: presentedId, enc: 1 })),
    ],
  };
  if (!(cardId in state.cards)) {
    // FR-V3: a right check on a transparent form outside divergent slots starts on the 4 d rung, not next day.
    const p = parseCardId(cardId);
    const fast = correct && content && p.type === "fm" && isFastTrackUnit(unitIdOfFm(cardId), content);
    next.cards = { ...state.cards, [cardId]: { ...newCard(now), due: fast ? startOfDayPlus(now, FAST_TRACK_DAYS) : nextDayStart(now) } };
  }
  next.history = bumpDay(state.history, now, (d) => { d.cards += 1; });
  return next;
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
