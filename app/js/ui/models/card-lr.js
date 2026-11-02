// Pure helpers for the listen & recognize card.
import { shuffle } from "../../core/random.js";

const lexemesOf = (s) => [...new Set(s.tokens.flatMap((t) => t.units.map((u) => u.lex)))];

/**
 * Pure. Up to 3 distractor sentences, never the answer or a sentence with identical text.
 * Preference: shares a lexeme, then shares a pattern, then same situation, then anything.
 */
export function pickDistractors(sentence, content, rng = Math.random, count = 3) {
  const taken = new Set([sentence.id]);
  const texts = new Set([sentence.ro]);
  const out = [];
  const tiers = [
    () => lexemesOf(sentence).flatMap((l) => content.sentencesByLexeme?.get(l) ?? []),
    () => (sentence.patterns ?? []).flatMap((p) => content.sentencesByPattern?.get(p) ?? []),
    () => (sentence.situations ?? []).flatMap((s) => content.sentencesBySituation?.get(s) ?? []),
    () => [...content.sentences.keys()],
  ];
  for (const tier of tiers) {
    const ids = shuffle([...new Set(tier())].filter((id) => !taken.has(id)), rng);
    for (const id of ids) {
      if (out.length >= count) return out;
      const s = content.sentences.get(id);
      if (!s || texts.has(s.ro)) continue;
      taken.add(id);
      texts.add(s.ro);
      out.push(s);
    }
  }
  return out;
}
