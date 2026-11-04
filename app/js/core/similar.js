// Near-identical sentences (ARCHITECTURE §2, PRD FR-S11): sentences that share at least half of their content
// words are treated like siblings when a session is built. Pure.
import { cmpStr } from "./sort.js";

export const SIMILAR_MIN_OVERLAP = 0.5;
export const SIMILAR_MIN_LEXEMES = 2;
export const SIMILAR_GROUP_CAP = 12;

/** The set of non-trivial lexeme ids a sentence is made of (function words marked `trivial` don't count). */
export function contentLexemes(sentence, content) {
  const out = new Set();
  for (const tok of sentence.tokens ?? []) {
    for (const u of tok.units ?? []) {
      if (!content.lexemes?.get(u.lex)?.trivial) out.add(u.lex);
    }
  }
  return out;
}

function jaccard(a, b) {
  let shared = 0;
  for (const x of a) if (b.has(x)) shared++;
  return shared / (a.size + b.size - shared);
}

/** Jaccard overlap (0..1) of two sentences' non-trivial lexemes. `a` and `b` are sentence ids; 0 if either is unknown or empty. */
export function sentenceOverlap(a, b, content) {
  const sa = content.sentences.get(a);
  const sb = content.sentences.get(b);
  if (!sa || !sb) return 0;
  const la = contentLexemes(sa, content);
  const lb = contentLexemes(sb, content);
  if (!la.size || !lb.size) return 0;
  return jaccard(la, lb);
}

/**
 * Union similar sentence pairs into groups (overlap ≥ 0.5, each with ≥ 2 non-trivial lexemes). Deterministic by id.
 * A group over `SIMILAR_GROUP_CAP` members is split by id order so one hub sentence can't link everything.
 * @returns {Map<string, string[]>} groupId (its smallest member id) → member ids, sorted; singletons are left out
 */
export function similarGroups(content) {
  const lex = new Map();
  for (const s of content.sentences.values()) {
    const set = contentLexemes(s, content);
    if (set.size >= SIMILAR_MIN_LEXEMES) lex.set(s.id, set);
  }
  const ids = [...lex.keys()].sort(cmpStr);
  const byLexeme = new Map();
  for (const id of ids) for (const l of lex.get(id)) {
    if (!byLexeme.has(l)) byLexeme.set(l, []);
    byLexeme.get(l).push(id);
  }
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (id) => {
    let x = id;
    while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); }
    return x;
  };
  for (const id of ids) {
    const cands = new Set();
    for (const l of lex.get(id)) for (const o of byLexeme.get(l)) if (o > id) cands.add(o);
    for (const o of cands) {
      if (jaccard(lex.get(id), lex.get(o)) < SIMILAR_MIN_OVERLAP) continue;
      const ra = find(id);
      const rb = find(o);
      if (ra === rb) continue;
      if (ra < rb) parent.set(rb, ra); else parent.set(ra, rb);
    }
  }
  const comps = new Map();
  for (const id of ids) {
    const r = find(id);
    if (!comps.has(r)) comps.set(r, []);
    comps.get(r).push(id);
  }
  const groups = new Map();
  for (const members of comps.values()) {
    if (members.length < 2) continue;
    for (let i = 0; i < members.length; i += SIMILAR_GROUP_CAP) {
      const chunk = members.slice(i, i + SIMILAR_GROUP_CAP);
      if (chunk.length > 1) groups.set(chunk[0], chunk);
    }
  }
  return groups;
}

/** sentence id → the group's member ids (including itself); the map `content.similarOf` holds. */
export function similarIndex(groups) {
  const out = new Map();
  for (const members of groups.values()) for (const m of members) out.set(m, members);
  return out;
}
