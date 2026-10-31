// Sentence families (ARCHITECTURE §2, PRD FR-R5): sentences that differ only in the form of one or more words,
// like "El locuiește în Cluj" / "Locuiești în Cluj" / "Locuiesc în Cluj". Pure.

/** Subject pronouns ignored when comparing sentences (the verb form already carries the person). */
export const SUBJECT_PRONOUNS = new Set(["eu", "tu", "el", "ea", "noi", "voi", "ei", "ele", "dumneavoastră"]);
export const FAMILY_CAP = 6;

const key = (t) => t.t.toLowerCase().replace(/[^\p{L}\p{N}-]+/gu, "");
const unit0 = (t) => t.units?.[0];

/** The tokens that count for comparison: without subject pronouns. */
function comparable(sentence) {
  return sentence.tokens.filter((t) => !SUBJECT_PRONOUNS.has(key(t)) && unit0(t));
}

/**
 * Indices (into the comparable tokens) where two sentences differ, or null if they aren't siblings: same token count,
 * every differing pair shares a lexeme with another form, at least one pair differs.
 */
export function differingPairs(a, b) {
  const ta = comparable(a);
  const tb = comparable(b);
  if (ta.length !== tb.length) return null;
  const out = [];
  for (let i = 0; i < ta.length; i++) {
    if (key(ta[i]) === key(tb[i])) continue;
    const x = unit0(ta[i]);
    const y = unit0(tb[i]);
    if (x.lex !== y.lex || x.form === y.form) return null;
    out.push(i);
  }
  return out.length ? out : null;
}

/**
 * Families as connected components of the sibling relation, capped at `FAMILY_CAP` members (the first by id).
 * @param {Iterable<object>} sentences
 * @returns {Map<string, string[]>} familyId (its smallest member id) → member ids, sorted
 */
export function findFamilies(sentences) {
  // Siblings share the lexeme of every comparable token, so bucket by that signature first.
  const buckets = new Map();
  for (const s of sentences) {
    const sig = comparable(s).map((t) => unit0(t).lex).join("|");
    if (!sig) continue;
    if (!buckets.has(sig)) buckets.set(sig, []);
    buckets.get(sig).push(s);
  }
  const families = new Map();
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    list.sort((a, b) => (a.id < b.id ? -1 : 1));
    const parent = list.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        if (differingPairs(list[i], list[j])) parent[find(j)] = find(i);
      }
    }
    const comps = new Map();
    list.forEach((s, i) => {
      const r = find(i);
      if (!comps.has(r)) comps.set(r, []);
      comps.get(r).push(s.id);
    });
    for (const ids of comps.values()) {
      if (ids.length < 2) continue;
      const members = ids.slice(0, FAMILY_CAP);
      families.set(members[0], members);
    }
  }
  return families;
}

/**
 * Lexeme-form units that vary inside a family (the forms its members differ in): `Map<familyId, Set<unitId>>`.
 * An `fm` card of one of these is a "family form" (FR-R5).
 */
export function familyForms(families, sentences) {
  const out = new Map();
  for (const [fid, members] of families) {
    const units = new Set();
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const a = sentences.get(members[i]);
        const b = sentences.get(members[j]);
        const idx = differingPairs(a, b);
        if (!idx) continue;
        const ta = comparable(a);
        const tb = comparable(b);
        for (const k of idx) {
          for (const u of [unit0(ta[k]), unit0(tb[k])]) units.add(`${u.lex}.${u.form}`);
        }
      }
    }
    out.set(fid, units);
  }
  return out;
}

/** The member's differing token text vs. the others, for the paradigm table: `{token, unit}` or null. */
export function differingToken(sentence, otherIds, sentences) {
  const ta = comparable(sentence);
  for (const oid of otherIds) {
    const idx = differingPairs(sentence, sentences.get(oid));
    if (idx) return { token: ta[idx[0]].t.replace(/[.,!?;:]+$/, ""), unit: `${unit0(ta[idx[0]]).lex}.${unit0(ta[idx[0]]).form}` };
  }
  return null;
}
