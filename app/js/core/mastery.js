// Mastery derivation and attempt compaction (ARCHITECTURE §7, PRD FR-P1/P2/X5). Pure: `now` is passed in.
import { parseCardId, clozeUnitIds, fmIdForUnit } from "./cards.js";
import { unitsRequiredForCard } from "./units.js";

const DAY = 86400000;
export const COMPACT_AFTER_MS = 90 * DAY;
const WINDOW = 20;
const MAX_AGG_LEXEMES = 50;
const STABLE_DAYS = 21;
const MASTERED_DAYS = 7;

const emptyAgg = () => ({ n: 0, correct: 0, lexemes: [], lastCorrectAt: 0 });

/** Fold attempts older than 90 days into aggregates. No `lastCompactionAt` change. */
function fold(state, now) {
  const cutoff = now - COMPACT_AFTER_MS;
  const keep = [];
  const old = [];
  for (const a of state.attempts) (a.t < cutoff ? old : keep).push(a);
  if (!old.length) return state;
  const aggs = { ...state.unitAggregates };
  for (const a of old) {
    const cur = aggs[a.u] ?? emptyAgg();
    const next = { ...cur, lexemes: [...cur.lexemes], n: cur.n + 1 };
    if (a.c === 1) {
      next.correct += 1;
      if (a.lx && !next.lexemes.includes(a.lx) && next.lexemes.length < MAX_AGG_LEXEMES) next.lexemes.push(a.lx);
      next.lastCorrectAt = Math.max(next.lastCorrectAt, a.t);
    }
    aggs[a.u] = next;
  }
  return { ...state, attempts: keep, unitAggregates: aggs };
}

/** FR-X5. Returns a new state; idempotent for a given `now`. */
export function compactAttempts(state, now) {
  return { ...fold(state, now), lastCompactionAt: now };
}

/**
 * Accuracy over the last 20 attempts of a unit. With fewer than 20 raw attempts the rest is filled from the
 * aggregate, treating its ratio as representative. Also the distinct correct lexemes and totals.
 */
function unitStats(unit, state) {
  const raw = state.attempts.filter((a) => a.u === unit).sort((a, b) => a.t - b.t);
  const agg = state.unitAggregates[unit];
  const recent = raw.slice(-WINDOW);
  let n = recent.length;
  let correct = recent.reduce((s, a) => s + a.c, 0);
  if (n < WINDOW && agg?.n > 0) {
    const fill = Math.min(WINDOW - n, agg.n);
    n += fill;
    correct += fill * (agg.correct / agg.n);
  }
  const lexemes = new Set(agg?.lexemes ?? []);
  for (const a of raw) if (a.c === 1) lexemes.add(a.lx);
  const everCorrect = (agg?.correct ?? 0) > 0 || raw.some((a) => a.c === 1);
  return { n, accuracy: n ? correct / n : 0, lexemes: lexemes.size, everCorrect, raw };
}

/** Does an `fm` card's unit realize pattern `patternId` in any sentence token? */
function fmCarriesPattern(lex, form, patternId, content) {
  for (const sid of content.sentencesByLexeme.get(lex) ?? []) {
    const s = content.sentences.get(sid);
    if (s?.tokens.some((t) => t.units.some((u) => u.lex === lex && u.form === form && u.pattern === patternId))) return true;
  }
  return false;
}

/** Does a non-`lr`, non-`kf` card exercise `unit`? An `fm` card carries its own unit and the patterns that unit realizes. */
function cardCarries(cardId, unit, content) {
  let p;
  try { p = parseCardId(cardId); } catch { return false; }
  if (p.type === "lr" || p.type === "kf") return false;
  if (p.type === "fm") {
    return unit.startsWith("pat:")
      ? fmCarriesPattern(p.lexemeId, p.formKey, unit.slice(4), content)
      : unit === `${p.lexemeId}.${p.formKey}`;
  }
  if (p.type === "cz") return unitsRequiredForCard(cardId, content).some((r) => r.u === unit);
  const s = content.sentences.get(p.sentenceId);
  if (!s) return false;
  if (unit.startsWith("pat:")) return (s.patterns ?? []).includes(unit.slice(4));
  return s.tokens.some((t) => t.units.some((u) => `${u.lex}.${u.form}` === unit));
}

function lastAttemptCorrect(unit, stats) {
  const last = stats.raw[stats.raw.length - 1];
  return last ? last.c === 1 : stats.everCorrect;
}

/** ARCHITECTURE §7.1: "not-started" | "seen" | "producing" | "automatic". */
export function patternState(id, state, content, now) {
  const s = fold(state, now);
  const seen = (content.sentencesByPattern.get(id) ?? []).some((sid) => sid in s.seenSentences);
  if (!seen) return "not-started";
  const unit = `pat:${id}`;
  const min = content.patterns.get(id)?.minLexemesForProducing ?? 5;
  const st = unitStats(unit, s);
  if (st.lexemes < min || st.accuracy < 0.7) return "seen";
  if (st.accuracy < 0.9 || st.lexemes < 10) return "producing";
  const stable = Object.entries(s.cards).some(([cid, c]) => c.stability >= STABLE_DAYS && cardCarries(cid, unit, content));
  return stable ? "automatic" : "producing";
}

/** Every pattern in the content → state. */
export function allPatternStates(state, content, now) {
  const s = fold(state, now);
  return Object.fromEntries([...content.patterns.keys()].map((id) => [id, patternState(id, s, content, now)]));
}

/** ARCHITECTURE §7.2: "unseen" | "seen" | "produced" | "stable". */
export function unitState(unitId, state, content, now) {
  const s = fold(state, now);
  const st = unitStats(unitId, s);
  if (st.everCorrect) {
    const stable =
      lastAttemptCorrect(unitId, st) &&
      Object.entries(s.cards).some(([cid, c]) => c.stability >= STABLE_DAYS && cardCarries(cid, unitId, content));
    return stable ? "stable" : "produced";
  }
  if (st.raw.length || s.unitAggregates[unitId]) return "seen";
  const dot = unitId.indexOf(".");
  const lex = unitId.slice(0, dot);
  const form = unitId.slice(dot + 1);
  for (const sid of content.sentencesByLexeme.get(lex) ?? []) {
    if (!(sid in s.seenSentences)) continue;
    if (content.sentences.get(sid)?.tokens.some((t) => t.units.some((u) => u.lex === lex && u.form === form))) return "seen";
  }
  return "unseen";
}

/** Latest attempt per card id and per unit id (ties go to the later one in the list). */
function latestAttempts(s) {
  const byCard = new Map();
  const byUnit = new Map();
  for (const a of s.attempts) {
    const c = byCard.get(a.card);
    if (!c || a.t >= c.t) byCard.set(a.card, a);
    const u = byUnit.get(a.u);
    if (!u || a.t >= u.t) byUnit.set(a.u, a);
  }
  return { byCard, byUnit };
}

/** A card with stability ≥ 7 days whose last attempt (`last`) was correct; with no attempt left, one still in Review. */
const passed = (card, last) => !!card && card.stability >= MASTERED_DAYS && (last ? last.c === 1 : card.state === 2);

/** Sentence ids with a passed whole-sentence production card (`xf`, `er`). */
function wholeSentencePassed(s, latest) {
  const out = new Set();
  for (const [cid, c] of Object.entries(s.cards)) {
    if (c.stability < MASTERED_DAYS) continue;
    let p;
    try { p = parseCardId(cid); } catch { continue; }
    if ((p.type === "xf" || p.type === "er") && passed(c, latest.byCard.get(cid))) out.add(p.sentenceId);
  }
  return out;
}

/** Every cloze unit's `fm` card is stable and last answered correctly, or the sentence has a passed `xf`/`er` card. */
function isMastered(sentenceId, s, content, latest, whole) {
  const sentence = content.sentences.get(sentenceId);
  if (!sentence) return false;
  const units = clozeUnitIds(sentence);
  if (units.length && units.every((u) => passed(s.cards[fmIdForUnit(u)], latest.byUnit.get(u)))) return true;
  return whole.has(sentenceId);
}

/** ARCHITECTURE §7.3: all cloze `fm` cards stable (≥ 7 days, last attempt correct), or an `xf`/`er` card of the sentence is. */
export function sentenceMastered(id, state, content, now) {
  const s = fold(state, now);
  const latest = latestAttempts(s);
  return isMastered(id, s, content, latest, wholeSentencePassed(s, latest));
}

/** Every mastered sentence id (same rule as `sentenceMastered`, for dashboards). */
export function masteredSentenceIds(state, content, now) {
  const s = fold(state, now);
  const latest = latestAttempts(s);
  const whole = wholeSentencePassed(s, latest);
  const out = new Set();
  for (const id of content.sentences.keys()) if (isMastered(id, s, content, latest, whole)) out.add(id);
  return out;
}

/** ARCHITECTURE §7.3 + FR-P4: a can-do is checkable once it has linked sentences and all of them are mastered. */
export function canDoCheckable(id, state, content, now) {
  const linked = canDoSentences(id, content);
  return linked.length > 0 && linked.every((sid) => sentenceMastered(sid, state, content, now));
}

/** Ids of the (non-retired) sentences linked to a can-do. */
export function canDoSentences(id, content) {
  return [...content.sentences.values()].filter((s) => (s.canDo ?? []).includes(id)).map((s) => s.id);
}

/** `{done, total}` mastered sentences for a can-do (the "k / n" shown while it isn't checkable). */
export function canDoMastery(id, state, content, now) {
  const linked = canDoSentences(id, content);
  return { done: linked.filter((sid) => sentenceMastered(sid, state, content, now)).length, total: linked.length };
}

const PRODUCED = new Set(["produced", "stable"]);
const PRODUCING = new Set(["producing", "automatic"]);

/** Unit ids (`lex.form`) a lexeme can appear as: its declared forms, plus `base` and any form used in a sentence. */
function lexemeUnits(lexId, content) {
  const forms = new Set(["base", ...Object.keys(content.lexemes.get(lexId)?.forms ?? {})]);
  for (const sid of content.sentencesByLexeme.get(lexId) ?? []) {
    for (const t of content.sentences.get(sid)?.tokens ?? []) for (const u of t.units) if (u.lex === lexId) forms.add(u.form);
  }
  return [...forms].map((f) => `${lexId}.${f}`);
}

/**
 * ARCHITECTURE §7.4. `done` counts patterns at ≥ producing, checked can-dos, and target lexemes with ≥1 form
 * at ≥ produced. Complete = all patterns done and can-dos and lexemes each ≥ 80%.
 */
export function levelProgress(levelId, state, content, now) {
  const level = content.levels.get(levelId);
  if (!level) throw new Error(`Unknown level: ${levelId}`);
  const s = fold(state, now);
  const required = level.requiredPatterns ?? [];
  const canDos = level.canDos ?? [];
  const lexemes = level.targetLexemes ?? [];
  const patterns = {
    done: required.filter((id) => PRODUCING.has(patternState(id, s, content, now))).length,
    total: required.length,
  };
  const cd = { done: canDos.filter((c) => c.id in (s.canDoChecked ?? {})).length, total: canDos.length };
  const lx = {
    done: lexemes.filter((id) => lexemeUnits(id, content).some((u) => PRODUCED.has(unitState(u, s, content, now)))).length,
    total: lexemes.length,
  };
  const ratio = (r) => (r.total ? r.done / r.total : 1);
  const complete = patterns.done === patterns.total && ratio(cd) >= 0.8 && ratio(lx) >= 0.8;
  const percent = ((ratio(patterns) + ratio(cd) + ratio(lx)) / 3) * 100;
  return { patterns, canDos: cd, lexemes: lx, complete, percent };
}
