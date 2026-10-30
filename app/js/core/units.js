// Learning units (ARCHITECTURE §6.1). Pure.
import { parseCardId, transformUnits, erUnits } from "./cards.js";

const unitId = (u) => `${u.lex}.${u.form}`;

/** Every "<lex>.<form>" from the token units, plus "pat:<id>" for each pattern. */
export function unitsForSentence(sentence) {
  const out = new Set();
  for (const t of sentence.tokens) for (const u of t.units) out.add(unitId(u));
  for (const p of sentence.patterns ?? []) out.add(`pat:${p}`);
  return [...out];
}

/**
 * Units a card exercises, as `{u, lx}` (lx = head lexeme, see ARCHITECTURE §4.3).
 * `fm`/`kf`: the form unit `<lex>.<form>`. `xf`/`sb`: see `transformUnits`. `er`: see `erUnits`. `cz`: the target token's units plus the patterns those units realize. `lr` records exposure, not attempts.
 */
export function unitsRequiredForCard(cardId, content) {
  const p = parseCardId(cardId);
  if (p.type === "kf" || p.type === "fm") return [{ u: `${p.lexemeId}.${p.formKey}`, lx: p.lexemeId }];
  if (p.type === "xf" || p.type === "sb") {
    const sentence = content.sentences.get(p.sentenceId);
    const t = sentence?.transforms?.[p.transformIndex];
    return t ? transformUnits(sentence, t, content) : [];
  }
  if (p.type === "er") {
    const sentence = content.sentences.get(p.sentenceId);
    return sentence ? erUnits(sentence) : [];
  }
  if (p.type !== "cz") return [];
  const token = content.sentences.get(p.sentenceId)?.tokens[p.tokenIndex];
  if (!token) return [];
  const out = new Map();
  for (const u of token.units) {
    out.set(unitId(u), { u: unitId(u), lx: u.lex });
    if (u.pattern) out.set(`pat:${u.pattern}`, { u: `pat:${u.pattern}`, lx: u.lex });
  }
  return [...out.values()];
}

function hasCorrect(unit, state) {
  if ((state.unitAggregates[unit]?.correct ?? 0) >= 1) return true;
  return state.attempts.some((a) => a.u === unit && a.c === 1 && !a.enc);
}

function inSeenSentence(lex, form, state, content) {
  for (const id of content.sentencesByLexeme.get(lex) ?? []) {
    if (!(id in state.seenSentences)) continue;
    const s = content.sentences.get(id);
    if (s?.tokens.some((t) => t.units.some((u) => u.lex === lex && (form == null || u.form === form)))) return true;
  }
  return false;
}

/** ARCHITECTURE §6.1. */
export function isKnown(unit, state, content) {
  if (unit.startsWith("pat:")) {
    return (content.sentencesByPattern.get(unit.slice(4)) ?? []).some((id) => id in state.seenSentences);
  }
  const dot = unit.indexOf(".");
  const lex = unit.slice(0, dot);
  const form = unit.slice(dot + 1);
  if (unit in (state.claimed ?? {})) return true;
  if (hasCorrect(unit, state)) return true;
  const lexeme = content.lexemes.get(lex);
  if (lexeme?.trivial && inSeenSentence(lex, null, state, content)) return true;
  // Seen in a recognized sentence, and another form of the same lexeme is already known.
  if (!inSeenSentence(lex, form, state, content)) return false;
  const forms = new Set(state.attempts.filter((a) => !a.enc && a.u.startsWith(lex + ".")).map((a) => a.u));
  for (const k of Object.keys(state.unitAggregates)) if (k.startsWith(lex + ".")) forms.add(k);
  return [...forms].some((u) => u !== unit && hasCorrect(u, state));
}
