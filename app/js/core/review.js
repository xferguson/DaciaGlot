// Review transitions: how a card, an `er` card, a paradigm or an immediate check changes the state (ARCHITECTURE §8). Pure.
import { newCard, review } from "./fsrs.js";
import { parseCardId, buildCardId, isCardType, unitIdOfFm, fmIdForUnit } from "./cards.js";
import { isFastTrackUnit } from "./select.js";
import { startOfDayPlus } from "./time.js";
import { unitId, parseUnitId } from "./unit-id.js";
import { bumpDay } from "./history.js";
import { scheduleCard, partialCredit, PRIMED_CREDIT } from "./schedule.js";
import { recallEntry, appendRecall } from "./calibrate.js";
import { creditProduced } from "./credit.js";

/**
 * Attempt records (ARCHITECTURE §4.3) for `units` (`{u, lx}[]`) answered right or wrong, shown as `presentedId`.
 * `enc` marks an immediate check of a new form (ignored by mastery and `isKnown`).
 */
export function makeAttempts(units, correct, now, presentedId, { enc = false } = {}) {
  return units.map(({ u, lx }) => ({ u, lx, c: correct ? 1 : 0, t: now, card: presentedId, ...(enc ? { enc: 1 } : {}) }));
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

/** Is this `fm` card's form claimed ("I can produce this", FR-R4)? Claimed forms are never tested. */
export const isClaimedCard = (cardId, state) => isCardType(cardId, "fm") && unitIdOfFm(cardId) in (state.claimed ?? {});

/** FR-R4: claim a lexeme-form unit (`<lex>.<form>`) as producible. Its `fm` card, if any, stays as it is. Returns a new state. */
export function claimForm(state, unit, now) {
  return { ...state, claimed: { ...state.claimed, [unit]: now } };
}

/** Undo a claim: its `fm` card (suspended while claimed) is active again with its old schedule. Returns a new state. */
export function unclaimForm(state, unit, _now) {
  const { [unit]: _gone, ...claimed } = state.claimed ?? {};
  return { ...state, claimed };
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
 * FSRS update (gaps from `scheduleCard`, scaled by `state.calibration.multiplier`; due `fm`/`er` reviews feed the recall log), attempts (production cards only, PRD FR-S3), `lr` exposure, day stats.
 * `unitsRequired` is `{u, lx}[]` from `unitsRequiredForCard`. `content` is only needed for `lr` exposure.
 * For an `fm` card, `presentedId` is the id it was shown as (`cz:<sid>:<i>` or `kf:<lex>:<form>`), recorded on the attempts; `unitsRequired` comes from it.
 * `primed` (T40, FR-S14): the card tested a word that was just on screen. A correct answer then only earns `partialCredit`
 * (`PRIMED_CREDIT`): no full review, no recall log, no `fm` credit; a wrong answer counts fully.
 * Returns a new state; the input is not mutated.
 */
export function applyReview(state, cardId, grade, unitsRequired, now, content, presentedId = cardId, { primed = false } = {}) {
  const p = parseCardId(cardId);
  const prev = state.cards[cardId];
  const multiplier = state.calibration?.multiplier ?? 1;
  const partial = primed && grade >= 2 && p.type !== "lr" ? partialCredit(prev, PRIMED_CREDIT, now, { multiplier }) : null;
  const card = partial ?? scheduleCard(prev, grade, now, { multiplier });
  const next = { ...state, cards: { ...state.cards, [cardId]: card } };
  if (p.type !== "lr" && !partial) next.calibration = appendRecall(state.calibration, recallEntry(prev, grade, now), now);
  let isNewSentence = false;
  if (p.type === "lr") {
    isNewSentence = !(p.sentenceId in state.seenSentences);
    Object.assign(next, exposure(state, p.sentenceId, now, content));
  } else {
    // FR-R4, evidence wins: a missed EN→RO card takes back the claims on the forms it tested.
    if (p.type === "er" && grade === 1 && unitsRequired.some(({ u }) => u in (state.claimed ?? {}))) {
      next.claimed = Object.fromEntries(Object.entries(state.claimed).filter(([u]) => !unitsRequired.some((r) => r.u === u)));
    }
    next.attempts = [...state.attempts, ...makeAttempts(unitsRequired, grade >= 2, now, presentedId)];
    // FR-R7: units produced in a transform / slot card count as their own review.
    if ((p.type === "xf" || p.type === "sb") && grade >= 2 && !partial) next.cards = creditProduced(next, unitsRequired.map(({ u }) => u), grade, now).cards;
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

/** Part-level result of a composite review that has no token diff: every form wrong on Again, every form right otherwise. */
const compositeParts = (composite, grade) => (grade === 1
  ? { missed: [...composite], ok: [], missedTokens: [] }
  : { missed: [], ok: [...composite], missedTokens: [] });

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
export function applyErReview(state, cardId, grade, unitsRequired, misses, now, content, presentedId = cardId, composite = null, { primed = false } = {}) {
  const parts = misses ?? (composite ? compositeParts(composite, grade) : null);
  if (!parts) return applyReview(state, cardId, grade, unitsRequired, now, content, presentedId, { primed });
  const clozeIds = new Set([...parts.missed, ...parts.ok]);
  const rest = unitsRequired.filter(({ u }) => !clozeIds.has(u));
  let next = applyReview(state, cardId, grade, rest, now, content, presentedId, { primed });
  if (composite) Object.assign(next, exposure(next, parseCardId(cardId).sentenceId, now, content));
  const lxOf = new Map(unitsRequired.map(({ u, lx }) => [u, lx]));
  const missedSet = new Set(parts.missed);
  const cards = { ...next.cards };
  let calibration = next.calibration;
  const multiplier = next.calibration?.multiplier ?? 1;
  for (const u of parts.missed) {
    const id = fmIdForUnit(u);
    cards[id] = cards[id] ? { ...review(cards[id], 1, now), lastGrade: 1 } : { ...newCard(now), lastGrade: 1 };
  }
  const okGrade = grade >= 3 ? grade : grade === 2 ? 2 : 3;
  for (const u of composite ?? []) {
    if (missedSet.has(u) || !clozeIds.has(u)) continue;
    const id = fmIdForUnit(u);
    calibration = appendRecall(calibration, recallEntry(cards[id], okGrade, now), now);
    cards[id] = scheduleCard(cards[id], okGrade, now, { multiplier });
  }
  const claimed = Object.fromEntries(Object.entries(next.claimed ?? {}).filter(([u]) => !missedSet.has(u)));
  // FR-R7: correct parts that no composite already reviewed credit their own `fm` card.
  const inComposite = new Set(composite ?? []);
  const credited = creditProduced({ ...next, cards, claimed }, parts.ok.filter((u) => !inComposite.has(u)), okGrade, now);
  const withLx = (u) => ({ u, lx: lxOf.get(u) ?? parseUnitId(u).lex });
  const attempts = [
    ...next.attempts,
    ...makeAttempts(parts.missed.map(withLx), false, now, presentedId),
    ...makeAttempts(parts.ok.map(withLx), true, now, presentedId),
  ];
  return { ...next, cards: credited.cards, claimed, attempts, ...(calibration ? { calibration } : {}) };
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
    attempts: [...state.attempts, ...makeAttempts(unitsRequired, correct, now, presentedId, { enc: true })],
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
