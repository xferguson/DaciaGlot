// Picks the sentence an `fm` card is shown in (ARCHITECTURE §3). Pure: `now` and `rng` are injected.
import { parseCardId, buildCardId, unitIdOfFm } from "./cards.js";
import { unitsForSentence, isKnown } from "./units.js";

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
  const best = scored.reduce((b, c) => (c.unknown < b.unknown || (c.unknown === b.unknown && c.last < b.last) ? c : b));
  const ties = scored.filter((c) => c.unknown === best.unknown && c.last === best.last);
  const pick = ties[Math.min(ties.length - 1, Math.floor(rng() * ties.length))];
  return { sentenceId: pick.sentenceId, tokenIndex: pick.tokenIndex };
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
