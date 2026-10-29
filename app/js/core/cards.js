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

/** `lr` is always unlocked; `cz` once the sentence's `lr` card exists. Later types are not built yet. */
export function isUnlocked(cardId, state, content) {
  let p;
  try { p = parseCardId(cardId); } catch { return false; }
  const sentence = content.sentences.get(p.sentenceId);
  if (!sentence) return false;
  if (p.type === "lr") return true;
  if (p.type === "cz") {
    return !!sentence.tokens[p.tokenIndex]?.cloze && !!state.cards[buildCardId("lr", p.sentenceId)];
  }
  return false;
}
