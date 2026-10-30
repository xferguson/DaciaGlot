// Session building, grading and review application (ARCHITECTURE §8). Pure: `now` and `rng` are injected.
import { newCard, review } from "./fsrs.js";
import { parseCardId, cardsForSentence, isUnlocked, newKfCards, newTransformCards, newErCards, pickPerSentence } from "./cards.js";
import { unitsForSentence, isKnown, unitsRequiredForCard } from "./units.js";
import { pickNewSentences } from "./select.js";

export const QUICK_CAP = 15;
export const SEC_PER_REVIEW = 12;
export const SEC_PER_NEW = 40;
/** Mix aims for a session of about this long: due reviews first, new sentences fill what's left. */
export const MIX_BUDGET_SEC = 12 * 60;
/** An unfinished session can be resumed for this long after its last answer. */
export const RESUME_MS = 12 * 60 * 60 * 1000;
const SPACING_GAP = 2;
const SPACING_WINDOW = 8;

/** Keys two cards share when they'd feel like a repeat: `s:<sentence>`, `l:<target lexeme>`; `new` marks a new `lr`. */
export function cardKeys(item, content) {
  const p = parseCardId(item.cardId);
  const keys = new Set();
  if (p.sentenceId) keys.add(`s:${p.sentenceId}`);
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

/** True when `active` (AppState.activeSession) still has cards left and was touched within `RESUME_MS`. */
export function resumable(active, now) {
  return !!active && Array.isArray(active.queue) && active.pos < active.queue.length && now - active.updatedAt <= RESUME_MS;
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

/** FR-S8: stable partition, cards whose sentence matches the focus first. `kf` cards have no sentence and keep their place after. */
export function focusFirst(cardIds, focus, content) {
  if (!focus) return cardIds;
  const hit = (id) => {
    const s = content.sentences.get(parseCardId(id).sentenceId);
    return !!s && (focus.type === "pattern" ? (s.patterns ?? []) : (s.situations ?? [])).includes(focus.id);
  };
  const flags = cardIds.map(hit);
  return [...cardIds.filter((_, i) => flags[i]), ...cardIds.filter((_, i) => !flags[i])];
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
 * - `session` (also used for focus): all due cards plus `newPerSession` new sentences.
 * The queue is then spaced out (`spaceOut`) so related cards are not back to back.
 * New sentences (`lr`, then `cz`) are chosen by `select.js` (FR-S5; the FR-S4 interim order is the cold-start fallback), spread so two new sentences' `lr` cards are never adjacent, then newly unlocked `kf` (T14), `xf`/`sb` (T15) and `er` (T20) cards. Due cards are thinned per sentence (FR-D9).
 * @returns {{queue: {cardId: string, isNew: boolean}[], estimateSec: number, blocked?: true, suggest?: {type: string, id: string}|null, plan?: {newCount: number, reviewPct: number}}}
 */
export function buildSession(opts) {
  const out = composeSession(opts);
  return { ...out, queue: spaceOut(out.queue, opts.content) };
}

function composeSession({ mode, focus = null, state, content, now, rng, newSentenceIds }) {
  const dueIds = pickPerSentence(focusFirst(dueCards(state, content, now), focus, content));
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
  }
  const groups = ids
    .map((id) => content.sentences.get(id))
    .filter(Boolean)
    .map((s) => cardsForSentence(s, content).map((cardId) => ({ cardId, isNew: true })));
  const k = groups.length;
  const kf = newKfCards(state, content).map((cardId) => ({ cardId, isNew: true }));
  const queue = [];
  if (k === 0) queue.push(...due);
  else {
    const slots = chunk(due, 2 * k + 1);
    queue.push(...slots[0]);
    groups.forEach((g, i) => {
      queue.push(g[0], ...slots[2 * i + 1], ...g.slice(1), ...slots[2 * i + 2]);
    });
  }
  const busy = new Set(dueIds.map(parseCardId).filter((p) => p.type === "xf" || p.type === "sb").map((p) => p.sentenceId));
  const xf = newTransformCards(state, content, { skip: busy }).map((cardId) => ({ cardId, isNew: true }));
  const taken = new Set([...busy, ...xf.map((x) => parseCardId(x.cardId).sentenceId)]);
  const er = newErCards(state, content, { skip: taken }).map((cardId) => ({ cardId, isNew: true }));
  queue.push(...kf, ...xf, ...er);
  const estimateSec = due.length * SEC_PER_REVIEW + (k + kf.length + xf.length + er.length) * SEC_PER_NEW;
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
 * FSRS update, attempts (production cards only, PRD FR-S3), `lr` exposure, day stats.
 * `unitsRequired` is `{u, lx}[]` from `unitsRequiredForCard`. `content` is only needed for `lr` exposure.
 * Returns a new state; the input is not mutated.
 */
export function applyReview(state, cardId, grade, unitsRequired, now, content) {
  const p = parseCardId(cardId);
  const card = review(state.cards[cardId] ?? newCard(now), grade, now);
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
      ...unitsRequired.map(({ u, lx }) => ({ u, lx, c: grade >= 2 ? 1 : 0, t: now, card: cardId })),
    ];
  }
  next.history = bumpDay(state.history, now, (d) => {
    d.cards += 1;
    if (isNewSentence) d.newSentences += 1;
  });
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
