// Session building, grading and review application (ARCHITECTURE §8). Pure: `now` and `rng` are injected.
import { newCard, review } from "./fsrs.js";
import { parseCardId, unitIdOfFm, cardsForSentence, isUnlocked, newKfCards, newTransformCards, newErCards, pickPerSentence } from "./cards.js";
import { unitsForSentence, isKnown, unitsRequiredForCard } from "./units.js";
import { pickNewSentences, focusList } from "./select.js";
import { carriersFor } from "./carrier.js";

export const QUICK_CAP = 15;
export const SEC_PER_REVIEW = 12;
export const SEC_PER_NEW = 40;
/** Mix aims for a session of about this long: due reviews first, new sentences fill what's left. */
export const MIX_BUDGET_SEC = 12 * 60;
/** With a focus, Mix also brings in up to this many of the most overdue cards from outside it (FR-S8). */
export const MIX_OUTSIDE = 3;
/** Below this many seen sentences, new sessions top up with the easiest sentences (FR-S4 order) when i+1 finds too few. */
export const COLD_START_SEEN = 30;
/** A new sentence costs `SEC_PER_NEW` for one `lr` plus one new form to check; each form more (or fewer) scales it (FR-R2). */
export const newSentenceSec = (forms) => (SEC_PER_NEW * (1 + forms)) / 2;
const SPACING_GAP = 2;
const SPACING_WINDOW = 8;

/** Keys two cards share when they'd feel like a repeat: `s:<sentence>`, `l:<target lexeme>`; `new` marks a new `lr`. */
export function cardKeys(item, content) {
  const p = parseCardId(item.cardId);
  const keys = new Set();
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
export function nextDayStart(now) {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
}

/**
 * Leaving a session early: new `fm` cards of a sentence that was already introduced (its `lr` reviewed, `from`) but
 * whose immediate check wasn't reached are created as new cards due the next local day, with no check (FR-R2).
 * `remaining` is the rest of the queue. Returns a new state.
 */
export function keepStarted(state, remaining, now) {
  const cards = { ...state.cards };
  for (const { cardId, isNew, from } of remaining) {
    if (!isNew || cardId in cards) continue;
    const p = parseCardId(cardId);
    if (p.type === "fm" && from && `lr:${from}` in cards) cards[cardId] = { ...newCard(now), due: nextDayStart(now) };
  }
  return { ...state, cards };
}

/** FR-S9: a card struggled with (Hard or wrong) twice in one session goes on the difficult list. */
export function markDifficult(state, cardId, now) {
  return { ...state, difficult: { ...state.difficult, [cardId]: now } };
}

/**
 * Mix mode: how many new sentences to add given the review load. All due cards stay in; new
 * sentences fill the rest of `MIX_BUDGET_SEC`, at most `newPerSession`, and drop to 0 once reviews fill it.
 * `reviewPct` is the review share of the estimated time.
 * @returns {{newCount: number, reviewPct: number}}
 */
export function mixPlan(due, newPerSession) {
  const room = Math.floor((MIX_BUDGET_SEC - due * SEC_PER_REVIEW) / SEC_PER_NEW);
  const newCount = Math.max(0, Math.min(newPerSession, room));
  const total = due * SEC_PER_REVIEW + newCount * SEC_PER_NEW;
  return { newCount, reviewPct: total ? Math.round((100 * due * SEC_PER_REVIEW) / total) : 0 };
}

/** PRD FR-S1: Medium (Good) climbs this ladder of gaps, in days, and stays on the top rung. */
export const MEDIUM_LADDER_DAYS = [1, 4, 16, 64, 256];
/** Easy waits this many times Medium's next gap (capped at the top rung). */
export const EASY_FACTOR = 3;
const DAY_MS = 864e5;

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

/** Due, unlocked cards whose sentence still exists, most overdue first. */
export function dueCards(state, content, now) {
  return Object.entries(state.cards)
    .filter(([id, c]) => c.due <= now && isUnlocked(id, state, content))
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

/** Put each new sentence's immediate checks (`check`, from `cardsForSentence`) straight after its `lr`. */
function glueChecks(queue) {
  const checks = queue.filter((q) => q.check);
  if (!checks.length) return queue;
  const out = queue.filter((q) => !q.check);
  for (const c of checks) {
    const at = out.findIndex((q) => q.cardId === `lr:${c.from}`);
    if (at < 0) { out.push(c); continue; }
    let i = at + 1;
    while (out[i]?.check && out[i].from === c.from) i++;
    out.splice(i, 0, c);
  }
  return out;
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
 * - `learn`: new material only (no due cards): `newPerSession` new sentences plus newly unlocked drills.
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
  return { ...out, queue: glueChecks(spaceOut(out.queue, opts.content)) };
}

function composeSession({ mode, focus: rawFocus = null, state, content, now, rng, newSentenceIds }) {
  const focus = focusList(rawFocus).length ? focusList(rawFocus) : null;
  let focused = dueInFocus(state, content, now, focus);
  if (focus && mode === "mix") {
    const outside = dueCards(state, content, now).filter((id) => !inFocus(id, focus, content, state)).slice(0, MIX_OUTSIDE);
    focused = [...focused, ...outside];
  }
  const duePicked = pickPerSentence(focused);
  const dueIds = burySiblings(duePicked, content);
  const allDue = dueIds.map((cardId) => ({ cardId, isNew: false }));
  if (mode === "quick" || mode === "review") {
    const queue = mode === "quick" ? allDue.slice(0, QUICK_CAP) : allDue;
    return { queue, estimateSec: queue.length * SEC_PER_REVIEW };
  }
  const due = mode === "learn" ? [] : allDue;
  const plan = mode === "mix" ? mixPlan(due.length, state.settings.newPerSession) : null;
  if (plan && plan.newCount === 0 && !newSentenceIds) {
    return { queue: due, estimateSec: due.length * SEC_PER_REVIEW, plan };
  }
  const want = plan ? plan.newCount : state.settings.newPerSession;
  let ids = newSentenceIds;
  if (!ids) {
    const pick = pickNewSentences(want, { focus, state, content, now, rng });
    if (pick.blocked) {
      const queue = due.slice();
      return { queue, estimateSec: queue.length * SEC_PER_REVIEW, blocked: true, suggest: pick.suggest };
    }
    ids = pick.sentences.length || focus ? pick.sentences : interimNewSentences(want, state, content);
    if (ids.length < want && Object.keys(state.seenSentences).length < COLD_START_SEEN) {
      // New profile: i+1 finds few sentences yet, so top up with the easiest ones (FR-S4 order).
      const have = new Set(ids);
      const extra = interimNewSentences(Infinity, state, content)
        .filter((id) => !have.has(id) && inFocus(`lr:${id}`, focus, content, state))
        .slice(0, want - ids.length);
      ids = [...ids, ...extra];
    }
  }
  // One schedule per word form: a form shared by two new sentences gets its `fm` card from the first.
  const claimed = new Set();
  const groups = ids
    .map((id) => content.sentences.get(id))
    .filter(Boolean)
    .map((s) => cardsForSentence(s, content, state)
      .filter((cardId) => !claimed.has(cardId) && claimed.add(cardId))
      .map((cardId) => (cardId.startsWith("fm:") ? { cardId, isNew: true, from: s.id, check: true } : { cardId, isNew: true })));
  const k = groups.length;
  const kf = focus ? [] : newKfCards(state, content).filter((id) => !claimed.has(id)).map((cardId) => ({ cardId, isNew: true }));
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
  const estimateSec = due.length * SEC_PER_REVIEW + (kf.length + xf.length + er.length) * SEC_PER_NEW
    + groups.reduce((sum, g) => sum + newSentenceSec(g.length - 1), 0);
  return plan ? { queue, estimateSec, plan } : { queue, estimateSec };
}

export function dayKey(now) {
  const d = new Date(now);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function bumpDay(history, now, fn) {
  const key = dayKey(now);
  const day = { minutes: 0, cards: 0, newSentences: 0, formsProduced: 0, ...history[key] };
  fn(day);
  return { ...history, [key]: day };
}

export function addMinutes(state, minutes, now) {
  return { ...state, history: bumpDay(state.history, now, (d) => { d.minutes += minutes; }) };
}

/**
 * FSRS update (Medium/Easy gaps from `ladderDays`), attempts (production cards only, PRD FR-S3), `lr` exposure, day stats.
 * `unitsRequired` is `{u, lx}[]` from `unitsRequiredForCard`. `content` is only needed for `lr` exposure.
 * For an `fm` card, `presentedId` is the id it was shown as (`cz:<sid>:<i>` or `kf:<lex>:<form>`), recorded on the attempts; `unitsRequired` comes from it.
 * Returns a new state; the input is not mutated.
 */
export function applyReview(state, cardId, grade, unitsRequired, now, content, presentedId = cardId) {
  const p = parseCardId(cardId);
  const prev = state.cards[cardId];
  let card = review(prev ?? newCard(now), grade, now);
  if (grade >= 3) {
    // FSRS keeps stability/difficulty (mastery reads them); the gap itself follows the ladder (FR-S1).
    const prevDays = prev?.lastReview != null ? Math.max(0, prev.due - prev.lastReview) / DAY_MS : 0;
    card = { ...card, due: now + ladderDays(prevDays, grade) * DAY_MS };
  }
  const next = { ...state, cards: { ...state.cards, [cardId]: card } };
  let isNewSentence = false;
  if (p.type === "lr") {
    isNewSentence = !(p.sentenceId in state.seenSentences);
    if (isNewSentence) next.seenSentences = { ...state.seenSentences, [p.sentenceId]: now };
    const sentence = content?.sentences.get(p.sentenceId);
    if (sentence) {
      const ls = { ...state.lexemeSentences };
      for (const t of sentence.tokens) {
        for (const u of t.units) {
          const cur = ls[u.lex] ?? [];
          if (!cur.includes(p.sentenceId)) ls[u.lex] = [...cur, p.sentenceId];
        }
      }
      next.lexemeSentences = ls;
    }
  } else {
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
 * FR-R2: the immediate check of a new form. Records `enc` attempts (ignored by mastery and `isKnown`) and, if the
 * `fm` card doesn't exist yet, creates it due the next local day whatever the answer; no FSRS review, no rating.
 * Returns a new state; the input is not mutated.
 */
export function applyCheck(state, cardId, correct, unitsRequired, now, presentedId = cardId) {
  const next = {
    ...state,
    attempts: [
      ...state.attempts,
      ...unitsRequired.map(({ u, lx }) => ({ u, lx, c: correct ? 1 : 0, t: now, card: presentedId, enc: 1 })),
    ],
  };
  if (!(cardId in state.cards)) next.cards = { ...state.cards, [cardId]: { ...newCard(now), due: nextDayStart(now) } };
  next.history = bumpDay(state.history, now, (d) => { d.cards += 1; });
  return next;
}

/**
 * PRD FR-S9: re-queue a wrong card once, 3–5 cards later. With `content`, it moves up to 3 further
 * so it doesn't land next to a related card (`cardKeys`). Returns the index it was inserted at.
 */
export function requeueWrong(queue, pos, item, rng, content) {
  let at = Math.min(queue.length, pos + 3 + Math.floor(rng() * 3));
  if (content) {
    const keys = cardKeys({ cardId: item.cardId }, content);
    const clash = (i) => i >= 0 && i < queue.length && overlaps(keys, cardKeys(queue[i], content));
    for (let i = at; i <= Math.min(queue.length, at + 3); i++) {
      if (!clash(i - 1) && !clash(i)) { at = i; break; }
    }
  }
  queue.splice(at, 0, { cardId: item.cardId, isNew: false, requeued: true });
  return at;
}
