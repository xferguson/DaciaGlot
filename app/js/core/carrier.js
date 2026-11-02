// Picks the sentence an `fm` card is shown in (ARCHITECTURE §3). Pure: `now` and `rng` are injected.
import { parseCardId, buildCardId, unitIdOfFm, clozeUnitIds } from "./cards.js";
import { unitsForSentence, isKnown } from "./units.js";
import { pickOne } from "./random.js";
import { DAY_MS } from "./time.js";

/** A carrier is skipped when it was named in this many of the unit's latest attempts. */
export const RECENT_ATTEMPTS = 3;

function sentenceOfCard(cardId) {
  try { return parseCardId(cardId).sentenceId ?? null; } catch { return null; }
}

/**
 * Seen sentences with a token that can be blanked for `unitId`: a `cloze: true` token carrying it, or any
 * token whose only unit it is. One entry per sentence (its first such token).
 * @returns {{sentenceId: string, tokenIndex: number}[]}
 */
export function carriersFor(unitId, state, content) {
  const lex = unitId.slice(0, unitId.indexOf("."));
  const out = [];
  for (const sid of content.sentencesByLexeme.get(lex) ?? []) {
    if (!(sid in state.seenSentences)) continue;
    const s = content.sentences.get(sid);
    const tokenIndex = s?.tokens.findIndex((t) =>
      t.units.some((u) => `${u.lex}.${u.form}` === unitId) && (t.cloze || t.units.length === 1));
    if (tokenIndex >= 0) out.push({ sentenceId: sid, tokenIndex });
  }
  return out;
}

const pickRandom = (list, rng) => {
  const { sentenceId, tokenIndex } = pickOne(list, rng);
  return { sentenceId, tokenIndex };
};

/**
 * The carrier for a unit that is due: a seen sentence not among the unit's last `recent` attempts and not in
 * `exclude`, with the fewest unknown other units, then the longest since it was last used (any attempt, else
 * when it was first seen), then `rng`. `null` when there is none.
 * @returns {{sentenceId: string, tokenIndex: number} | null}
 */
export function pickCarrier(unitId, state, content, { now, rng = Math.random, exclude = new Set(), recent = RECENT_ATTEMPTS } = {}) {
  const lastUsed = new Map();
  const mine = [];
  for (const a of state.attempts) {
    const sid = sentenceOfCard(a.card);
    if (sid && a.t > (lastUsed.get(sid) ?? -Infinity)) lastUsed.set(sid, a.t);
    if (a.u === unitId) mine.push(a);
  }
  const skip = new Set(exclude);
  if (recent > 0) {
    mine.sort((a, b) => a.t - b.t);
    for (const a of mine.slice(-recent)) {
      const sid = sentenceOfCard(a.card);
      if (sid) skip.add(sid);
    }
  }
  const scored = carriersFor(unitId, state, content)
    .filter((c) => !skip.has(c.sentenceId))
    .map((c) => ({
      ...c,
      unknown: unitsForSentence(content.sentences.get(c.sentenceId))
        .filter((u) => u !== unitId && !isKnown(u, state, content)).length,
      last: lastUsed.get(c.sentenceId) ?? state.seenSentences[c.sentenceId] ?? 0,
    }));
  if (!scored.length) return null;
  // FR-R5: a form that varies inside a family is shown in a random family member, so the learner must choose it.
  const fams = (content.familiesOfUnit?.get(unitId) ?? []).flatMap((f) => content.families.get(f) ?? []);
  const inFamily = scored.filter((c) => fams.includes(c.sentenceId));
  if (inFamily.length) return pickRandom(inFamily, rng);
  const best = scored.reduce((b, c) => (c.unknown < b.unknown || (c.unknown === b.unknown && c.last < b.last) ? c : b));
  return pickRandom(scored.filter((c) => c.unknown === best.unknown && c.last === best.last), rng);
}

/**
 * How a due `fm` card is shown now: a cloze in a carrier sentence, else the key-form drill if the lexeme has
 * a label for the form, else the least recently used carrier. `presentedId` is the id recorded on the attempt.
 * `opts.prefer` is a sentence id to use when it can carry the form (the sentence a new `fm` card came from).
 * `null` when the form has no seen sentence and no key-form label.
 * @returns {{type: "cz", presentedId: string, sentenceId: string, tokenIndex: number} | {type: "kf", presentedId: string} | null}
 */
export function resolveFm(fmId, state, content, opts = {}) {
  const unitId = unitIdOfFm(fmId);
  const cz = (c) => ({ type: "cz", presentedId: buildCardId("cz", c.sentenceId, c.tokenIndex), ...c });
  const preferred = opts.prefer && carriersFor(unitId, state, content).find((x) => x.sentenceId === opts.prefer);
  const c = preferred || pickCarrier(unitId, state, content, opts);
  if (c) return cz(c);
  const { lexemeId, formKey } = parseCardId(fmId);
  const lexeme = content.lexemes.get(lexemeId);
  if (lexeme?.keyForms?.includes(formKey) && lexeme.forms?.[formKey]) {
    return { type: "kf", presentedId: buildCardId("kf", lexemeId, formKey) };
  }
  const any = pickCarrier(unitId, state, content, { ...opts, exclude: new Set(), recent: 0 });
  return any ? cz(any) : null;
}

/** A composite never reuses a sentence that carried any form in this many days (FR-V1). */
export const COMPOSITE_COOLDOWN_DAYS = 7;
/** At most this many forms in one composite. */
export const COMPOSITE_MAX_FORMS = 4;

/**
 * FR-V1 (T32): the sentence for a composite `er` review of several due easy forms. A candidate has at least two of
 * `dueEasyUnits` among its cloze units and every other unit known (`isKnown`, which includes claimed), so it never
 * introduces a new form; it is not a carrier used in the last 7 days. The one covering the most forms wins (up to 4),
 * then a sentence the learner hasn't seen, then `rng`. `opts.exclude` is a set of sentence ids to skip and `opts.allow`
 * an optional `(sentenceId) => boolean` (e.g. a focus filter).
 * @returns {{sentenceId: string, units: string[]} | null}
 */
export function pickComposite(dueEasyUnits, state, content, now, rng = Math.random, { exclude = new Set(), allow = null } = {}) {
  const due = new Set(dueEasyUnits);
  const cutoff = now - COMPOSITE_COOLDOWN_DAYS * DAY_MS;
  const recent = new Set();
  for (const a of state.attempts) if (a.t > cutoff) { const sid = sentenceOfCard(a.card); if (sid) recent.add(sid); }
  const candidates = new Set();
  for (const u of due) for (const sid of content.sentencesByLexeme.get(u.slice(0, u.indexOf("."))) ?? []) candidates.add(sid);
  const found = [];
  for (const sid of candidates) {
    if (exclude.has(sid) || recent.has(sid) || (allow && !allow(sid))) continue;
    const s = content.sentences.get(sid);
    if (!s?.en) continue;
    const cloze = clozeUnitIds(s);
    const covered = cloze.filter((u) => due.has(u));
    if (covered.length < 2) continue;
    const coveredSet = new Set(covered);
    if (!unitsForSentence(s).every((u) => coveredSet.has(u) || isKnown(u, state, content))) continue;
    found.push({ sentenceId: sid, units: covered.slice(0, COMPOSITE_MAX_FORMS), unseen: !(sid in state.seenSentences) });
  }
  if (!found.length) return null;
  const rank = (c) => c.units.length * 2 + (c.unseen ? 1 : 0);
  const top = Math.max(...found.map(rank));
  const best = found.filter((c) => rank(c) === top).sort((a, b) => (a.sentenceId < b.sentenceId ? -1 : 1));
  const { sentenceId, units } = pickOne(best, rng);
  return { sentenceId, units };
}
