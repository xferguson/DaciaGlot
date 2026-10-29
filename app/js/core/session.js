// Session building, grading and review application (ARCHITECTURE §8). Pure: `now` and `rng` are injected.
import { newCard, review } from "./fsrs.js";
import { parseCardId, cardsForSentence, isUnlocked } from "./cards.js";
import { unitsForSentence, isKnown } from "./units.js";

export const QUICK_CAP = 15;
export const SEC_PER_REVIEW = 12;
export const SEC_PER_NEW = 40;

/** PRD FR-S2. */
export function gradeFromResult({ result, usedHint = false, attemptNo = 1, tooEasy = false }) {
  if (result === "wrong") return 1;
  if (usedHint || attemptNo > 1) return 2;
  return tooEasy ? 4 : 3;
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

function chunk(list, parts) {
  const out = Array.from({ length: parts }, () => []);
  list.forEach((x, i) => out[Math.min(parts - 1, Math.floor((i * parts) / list.length))].push(x));
  return out;
}

/**
 * Quick: due cards only, capped at 15. Session: due cards plus new sentences (`lr`, then `cz`),
 * spread so two new sentences' `lr` cards are never adjacent.
 * @returns {{queue: {cardId: string, isNew: boolean}[], estimateSec: number}}
 */
export function buildSession({ mode, state, content, now, rng: _rng, newSentenceIds }) {
  const due = dueCards(state, content, now).map((cardId) => ({ cardId, isNew: false }));
  if (mode === "quick") {
    const queue = due.slice(0, QUICK_CAP);
    return { queue, estimateSec: queue.length * SEC_PER_REVIEW };
  }
  const ids = newSentenceIds ?? interimNewSentences(state.settings.newPerSession, state, content);
  const groups = ids
    .map((id) => content.sentences.get(id))
    .filter(Boolean)
    .map((s) => cardsForSentence(s, content).map((cardId) => ({ cardId, isNew: true })));
  const k = groups.length;
  const queue = [];
  if (k === 0) queue.push(...due);
  else {
    const slots = chunk(due, 2 * k + 1);
    queue.push(...slots[0]);
    groups.forEach((g, i) => {
      queue.push(g[0], ...slots[2 * i + 1], ...g.slice(1), ...slots[2 * i + 2]);
    });
  }
  return { queue, estimateSec: due.length * SEC_PER_REVIEW + k * SEC_PER_NEW };
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

/** PRD FR-S9: re-queue a wrong card once, 3–5 cards later. Returns the index it was inserted at. */
export function requeueWrong(queue, pos, item, rng) {
  const at = Math.min(queue.length, pos + 3 + Math.floor(rng() * 3));
  queue.splice(at, 0, { cardId: item.cardId, isNew: false, requeued: true });
  return at;
}
