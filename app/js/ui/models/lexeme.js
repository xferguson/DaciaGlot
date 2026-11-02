import { unitState } from "../../core/mastery.js";
import { labelFor } from "../../core/cards.js";

export function lexemeModel(id, state, content, now) {
  const lexeme = content.lexemes.get(id);
  if (!lexeme) return null;
  // Key forms, plus any other form of this word that was claimed from feedback (so the claim can be undone here).
  const keys = [...new Set([...(lexeme.keyForms ?? []), ...Object.keys(state.claimed).filter((u) => u.startsWith(`${id}.`)).map((u) => u.slice(id.length + 1))])];
  const forms = keys.map((key) => ({
    key,
    label: labelFor(key),
    text: lexeme.forms?.[key] ?? (key === "base" ? lexeme.lemma : ""),
    state: unitState(`${id}.${key}`, state, content, now),
    unit: `${id}.${key}`,
    claimed: `${id}.${key}` in state.claimed,
  }));
  const sentences = (content.sentencesByLexeme.get(id) ?? [])
    .filter((sid) => sid in state.seenSentences)
    .map((sid) => content.sentences.get(sid));
  return { lexeme, forms, sentences };
}
