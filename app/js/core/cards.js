// Card ids and unlock rules (ARCHITECTURE §3). Pure.

export const CARD_TYPES = ["lr", "cz", "kf", "xf", "sb", "er"];

/** `lr:<sid>` → {type, sentenceId}; `cz:<sid>:<i>` adds tokenIndex; `kf:<lex>:<form>` → {lexemeId, formKey}. */
export function parseCardId(id) {
  const parts = String(id).split(":");
  const type = parts[0];
  if (!CARD_TYPES.includes(type)) throw new Error(`Bad card id: ${id}`);
  if (type === "kf") return { type, lexemeId: parts[1], formKey: parts.slice(2).join(":") };
  const out = { type, sentenceId: parts[1] };
  if (type === "cz" || type === "xf" || type === "sb") {
    const n = Number(parts[2]);
    if (!Number.isInteger(n) || n < 0) throw new Error(`Bad card id: ${id}`);
    if (type === "cz") out.tokenIndex = n;
    else out.transformIndex = n;
  }
  return out;
}

export function buildCardId(type, ...parts) {
  return [type, ...parts].join(":");
}

/** Phase 1: one `lr` plus one `cz` per cloze token. */
export function cardsForSentence(sentence, _content) {
  const ids = [buildCardId("lr", sentence.id)];
  sentence.tokens.forEach((t, i) => {
    if (t.cloze) ids.push(buildCardId("cz", sentence.id, i));
  });
  return ids;
}

/** Human labels for form keys (PRD FR-D3), shown on `kf` cards. */
export const FORM_LABELS = {
  inf: "infinitiv",
  pres1sg: "eu · prezent", pres2sg: "tu · prezent", pres3sg: "el/ea · prezent",
  pres1pl: "noi · prezent", pres2pl: "voi · prezent", pres3pl: "ei/ele · prezent",
  ppl: "participiu (am …)",
  subj1sg: "eu · să …", subj2sg: "tu · să …", subj3: "el/ea · să …",
  subj1pl: "noi · să …", subj2pl: "voi · să …", subj3pl: "ei/ele · să …",
  imp2sg: "imperativ · tu", imp2pl: "imperativ · voi",
  impf1sg: "eu · imperfect", impf2sg: "tu · imperfect", impf3sg: "el/ea · imperfect",
  impf1pl: "noi · imperfect", impf2pl: "voi · imperfect", impf3pl: "ei/ele · imperfect",
  ger: "gerunziu",
  sg: "singular", pl: "plural",
  sgDef: "the … (sg.)", plDef: "the … (pl.)",
  sgGenDat: "of/to the … (sg.)", plGenDat: "of/to the … (pl.)",
  voc: "vocativ",
  msg: "masculin sg.", fsg: "feminin sg.", mpl: "masculin pl.", fpl: "feminin pl.",
  acc: "acuzativ", accShort: "acuzativ (scurt)", dat: "dativ", datShort: "dativ (scurt)",
};

export const labelFor = (formKey) => FORM_LABELS[formKey] ?? formKey;

export const KF_MIN_SENTENCES = 2;
export const KF_PER_LEXEME = 3;
export const KF_PER_SESSION = 8;

/** True once a lexeme has been met in enough distinct sentences for its `kf` cards to unlock (PRD FR-D3). */
export function kfUnlockedFor(lexemeId, state) {
  return (state.lexemeSentences?.[lexemeId]?.length ?? 0) >= KF_MIN_SENTENCES;
}

/**
 * New `kf` cards to introduce this session: per unlocked lexeme, the first `perLexeme` not-yet-introduced
 * `keyForms` in order; lexemes by frequency rank; at most `cap` in total.
 */
export function newKfCards(state, content, { perLexeme = KF_PER_LEXEME, cap = KF_PER_SESSION } = {}) {
  const lexemes = [...content.lexemes.values()]
    .filter((l) => l.keyForms?.length && kfUnlockedFor(l.id, state))
    .sort((a, b) => (a.freq ?? Infinity) - (b.freq ?? Infinity) || (a.id < b.id ? -1 : 1));
  const out = [];
  for (const l of lexemes) {
    const ids = l.keyForms
      .filter((f) => l.forms?.[f])
      .map((f) => buildCardId("kf", l.id, f))
      .filter((id) => !(id in state.cards))
      .slice(0, perLexeme);
    for (const id of ids) if (out.length < cap) out.push(id);
  }
  return out;
}

/** A sentence the learner has seen that contains this exact lexeme form, or null. Earliest seen first. */
export function exampleSentenceFor(lexemeId, formKey, state, content) {
  const seen = (state.lexemeSentences?.[lexemeId] ?? [])
    .filter((id) => id in state.seenSentences)
    .sort((a, b) => state.seenSentences[a] - state.seenSentences[b] || (a < b ? -1 : 1));
  for (const id of seen) {
    const s = content.sentences.get(id);
    if (s?.tokens.some((t) => t.units.some((u) => u.lex === lexemeId && u.form === formKey))) return s;
  }
  return null;
}

/** `lr` is always unlocked; `cz` once the sentence's `lr` card exists; `kf` once its lexeme was met in ≥2 sentences. */
export function isUnlocked(cardId, state, content) {
  let p;
  try { p = parseCardId(cardId); } catch { return false; }
  if (p.type === "kf") {
    const l = content.lexemes.get(p.lexemeId);
    return !!l?.keyForms?.includes(p.formKey) && !!l.forms?.[p.formKey] && kfUnlockedFor(p.lexemeId, state);
  }
  const sentence = content.sentences.get(p.sentenceId);
  if (!sentence) return false;
  if (p.type === "lr") return true;
  if (p.type === "cz") {
    return !!sentence.tokens[p.tokenIndex]?.cloze && !!state.cards[buildCardId("lr", p.sentenceId)];
  }
  return false;
}
