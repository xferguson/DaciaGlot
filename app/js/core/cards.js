// Card ids and unlock rules (ARCHITECTURE §3). Pure.
import { tokenize, tokenKey } from "./normalize.js";

export const CARD_TYPES = ["lr", "fm", "cz", "kf", "xf", "sb", "er"];

/**
 * `lr:<sid>` → {type, sentenceId}; `cz:<sid>:<i>` adds tokenIndex; `fm:<lex>:<form>` and `kf:<lex>:<form>` → {lexemeId, formKey}.
 * Only `fm` is a stored schedule for a word form; `cz` and `kf` are how an `fm` is presented (they appear in `attempt.card`).
 */
export function parseCardId(id) {
  const parts = String(id).split(":");
  const type = parts[0];
  if (!CARD_TYPES.includes(type)) throw new Error(`Bad card id: ${id}`);
  if (type === "kf" || type === "fm") return { type, lexemeId: parts[1], formKey: parts.slice(2).join(":") };
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

/** `<lex>.<form>` for each unit of each `cloze: true` token, in order, without repeats. */
export function clozeUnitIds(sentence) {
  const out = new Set();
  for (const t of sentence.tokens) if (t.cloze) for (const u of t.units) out.add(`${u.lex}.${u.form}`);
  return [...out];
}

/** The `fm` card id of a lexeme-form unit id `<lex>.<form>`. */
export function fmIdForUnit(unitId) {
  const dot = unitId.indexOf(".");
  return buildCardId("fm", unitId.slice(0, dot), unitId.slice(dot + 1));
}

/** The lexeme-form unit id of an `fm` (or `kf`) card id. */
export function unitIdOfFm(cardId) {
  const p = parseCardId(cardId);
  return `${p.lexemeId}.${p.formKey}`;
}

/**
 * `lr:<sid>` plus an `fm` card for each lexeme-form unit of a `cloze: true` token that has none yet in
 * `state.cards` (all of them when `state` is omitted). One schedule per word form (FR-D2).
 */
export function cardsForSentence(sentence, _content, state = null) {
  const ids = [buildCardId("lr", sentence.id)];
  for (const unit of clozeUnitIds(sentence)) {
    const id = fmIdForUnit(unit);
    if (!state || !(id in state.cards)) ids.push(id);
  }
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

/** Leipzig gloss suffix per form key (EXP-06). An empty string means the form adds nothing (`base`). */
export const LEIPZIG = {
  inf: "INF",
  pres1sg: "PRS.1SG", pres2sg: "PRS.2SG", pres3sg: "PRS.3SG",
  pres1pl: "PRS.1PL", pres2pl: "PRS.2PL", pres3pl: "PRS.3PL",
  ppl: "PTCP",
  subj1sg: "SBJV.1SG", subj2sg: "SBJV.2SG", subj3: "SBJV.3",
  subj1pl: "SBJV.1PL", subj2pl: "SBJV.2PL", subj3pl: "SBJV.3PL",
  imp2sg: "IMP.2SG", imp2pl: "IMP.2PL",
  impf1sg: "IMPF.1SG", impf2sg: "IMPF.2SG", impf3sg: "IMPF.3SG",
  impf1pl: "IMPF.1PL", impf2pl: "IMPF.2PL", impf3pl: "IMPF.3PL",
  ger: "GER",
  sg: "SG", pl: "PL",
  sgDef: "SG.DEF", plDef: "PL.DEF",
  sgGenDat: "SG.DEF.GEN-DAT", plGenDat: "PL.DEF.GEN-DAT",
  voc: "VOC",
  msg: "M.SG", fsg: "F.SG", mpl: "M.PL", fpl: "F.PL",
  acc: "ACC", accShort: "ACC.CL", dat: "DAT", datShort: "DAT.CL",
  // Keys used by auxiliaries, particles and a few determiners (not shown on `kf` cards).
  "1sg": "1SG", "2sg": "2SG", "3sg": "3SG", "1pl": "1PL", "2pl": "2PL", "3pl": "3PL",
  m: "M", f: "F",
  base: "", short: "",
};

const PRON_ID = /^pron-([123])(sg|pl)(?:-([mf]))?$/;

/** The lemma part of a gloss: `lemmaGloss`, else the first word of `gloss` (without a leading "to "). */
function glossBase(lexeme) {
  if (lexeme.lemmaGloss) return lexeme.lemmaGloss;
  const g = String(lexeme.gloss ?? lexeme.id);
  if (!/[a-z]/.test(g)) return g; // already in small-caps style, e.g. "NEG"
  const word = g.replace(/^\(/, "").replace(/^to /, "").split(/[\s,;/()]+/).find(Boolean);
  return word ?? lexeme.id;
}

/** Leipzig-style gloss of one lexeme form, e.g. `be.PRS.2SG`, `2SG.ACC.CL`, `NEG`. */
export function leipzigFor(lexeme, formKey) {
  const suffix = LEIPZIG[formKey] ?? String(formKey).toUpperCase();
  const pron = lexeme.pos === "pron" && PRON_ID.exec(lexeme.id);
  if (pron) {
    const person = `${pron[1]}${pron[2].toUpperCase()}${pron[3] ? `.${pron[3].toUpperCase()}` : ""}`;
    return suffix ? `${person}.${suffix}` : person;
  }
  const base = glossBase(lexeme);
  return suffix ? `${base}.${suffix}` : base;
}

export const KF_MIN_SENTENCES = 2;
export const KF_PER_LEXEME = 3;
export const KF_PER_SESSION = 8;

/** True once a lexeme has been met in enough distinct sentences for its `kf` cards to unlock (PRD FR-D3). */
export function kfUnlockedFor(lexemeId, state) {
  return (state.lexemeSentences?.[lexemeId]?.length ?? 0) >= KF_MIN_SENTENCES;
}

/**
 * New `fm` cards to introduce this session (key forms that have no `fm` card yet): per unlocked lexeme, the first `perLexeme` not-yet-introduced
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
      .map((f) => buildCardId("fm", l.id, f))
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

// ---- Transformation (`xf`) and slot-building (`sb`) cards (PRD FR-D4, D5, D9; CONTENT_GUIDE §3) ----

export const XF_PER_SESSION = 4;

const PERSON = { "1sg": "I", "2sg": "you", "3sg": "he/she", "1pl": "we", "2pl": "you (pl.)", "3pl": "they" };
const TENSE = { pres: "present", perf: "past", fut: "future", cond: "would", impf: "imperfect" };
const OBJ = {
  "acc-3sg-m": "him/it", "acc-3sg-f": "her/it", "acc-3pl-m": "them", "acc-3pl-f": "them",
  "acc-1sg": "me", "acc-2sg": "you", "acc-1pl": "us", "acc-2pl": "you (pl.)",
};
const DAT = {
  "dat-1sg": "me", "dat-2sg": "you", "dat-3sg-m": "him", "dat-3sg-f": "her",
  "dat-1pl": "us", "dat-2pl": "you (pl.)", "dat-3pl": "them",
};
const MODAL = { vrea: "I want", putea: "I can", trebui: "I must" };

/** The instruction shown for a transform op (CONTENT_GUIDE §3). The one renderer for every op. */
export function opInstruction(op) {
  const [name, arg = ""] = String(op).split(":");
  switch (name) {
    case "negate": return "Make it negative";
    case "affirm": return "Make it positive";
    case "person": return `→ ${PERSON[arg.split(">")[1]] ?? arg}`;
    case "tense": return `→ ${TENSE[arg.split(">")[1]] ?? arg}`;
    case "add-obj": return `Replace the object with '${OBJ[arg] ?? arg}'`;
    case "add-dat": return `Add 'to ${DAT[arg] ?? arg}'`;
    case "modal": return `Start with '${MODAL[arg] ?? arg}'`;
    case "question": return "Make it a question";
    case "plural": return "→ plural";
    case "singular": return "→ singular";
    case "definite": return "→ the X";
    case "indefinite": return "→ a X";
    case "formal": return "→ dumneavoastră";
    default: return String(op);
  }
}

/** Pattern ids an op itself introduces, whatever the sentence (filtered against content by callers). */
export function opPatterns(op) {
  const [name, arg = ""] = String(op).split(":");
  switch (name) {
    case "negate": return ["neg-nu"];
    case "tense": {
      const to = arg.split(">")[1];
      return to === "perf" ? ["perfect-compus"] : to === "fut" ? ["fut-o-sa"] : [];
    }
    case "add-obj": return ["clitic-acc"];
    case "add-dat": return ["clitic-dat"];
    case "modal": return arg === "vrea" || arg === "putea" ? ["modal-sa-12"] : [];
    case "plural": return ["noun-pl"];
    case "definite": return ["def-sg"];
    default: return [];
  }
}

/** Patterns a transform needs: the op's own plus those on the source tokens it changes. */
export function transformPatterns(sentence, transform, content) {
  const out = new Set(opPatterns(transform.op));
  for (const i of transform.targetTokens ?? []) {
    for (const u of sentence.tokens[i]?.units ?? []) if (u.pattern) out.add(u.pattern);
  }
  return [...out].filter((id) => content.patterns.has(id));
}

const patternSeen = (id, state, content) =>
  (content.sentencesByPattern.get(id) ?? []).some((sid) => sid in state.seenSentences);

/** FR-D4: every lexeme in the sentence has had its key-forms cards introduced. */
function keyFormsIntroduced(sentence, state, content) {
  const lexes = new Set(sentence.tokens.flatMap((t) => t.units.map((u) => u.lex)));
  for (const id of lexes) {
    const l = content.lexemes.get(id);
    for (const f of l?.keyForms ?? []) {
      if (l.forms?.[f] && !(buildCardId("fm", id, f) in state.cards)) return false;
    }
  }
  return true;
}

function transformOf(sentence, idx) {
  return sentence?.transforms?.[idx] ?? null;
}

/** FR-D4. */
export function xfUnlocked(sentence, idx, state, content) {
  const t = transformOf(sentence, idx);
  if (!t || !(sentence.id in state.seenSentences)) return false;
  return keyFormsIntroduced(sentence, state, content)
    && transformPatterns(sentence, t, content).every((id) => patternSeen(id, state, content));
}

/** FR-D5. */
export function sbUnlocked(sentence, idx, state, content) {
  const t = transformOf(sentence, idx);
  if (!t || !(sentence.id in state.seenSentences)) return false;
  return transformPatterns(sentence, t, content).every((id) => patternSeen(id, state, content));
}

/** Longest-common-subsequence alignment on token keys: `pairs` are `[srcIdx, resIdx]`. */
function alignTokens(src, res) {
  const a = src.map(tokenKey);
  const b = res.map(tokenKey);
  const dp = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { pairs.push([i++, j++]); }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
}

const lemmaOf = (lexeme, fallback) => {
  if (!lexeme) return fallback;
  return lexeme.pos === "verb" ? lexeme.lemma.replace(/^a /, "") : lexeme.lemma;
};

/**
 * Slots for an `sb` card. Result tokens that match a source token become plain lemmas; each run of changed
 * result tokens becomes one chip group of the slot labels of the patterns involved (op + changed source tokens).
 * `gloss` holds one Leipzig label per resolved result token (`[]` when none resolve; `labels` is then the fallback).
 * @returns {Array<{type:"word", text:string} | {type:"slot", labels:string[], gloss:string[], patterns:string[]}>}
 */
export function slotsFor(sentence, transform, content) {
  const src = sentence.tokens.map((t) => t.t);
  const res = tokenize(transform.ro);
  const matched = new Map(alignTokens(src, res).map(([i, j]) => [j, i]));
  const patterns = transformPatterns(sentence, transform, content);
  const labels = patterns.map((id) => content.patterns.get(id)?.slotLabel ?? id);
  const hints = (transform.targetTokens ?? []).flatMap((i) => sentence.tokens[i]?.units ?? []);
  const out = [];
  let inRun = false;
  let run = null;
  res.forEach((tok, j) => {
    if (matched.has(j)) {
      inRun = false;
      const st = sentence.tokens[matched.get(j)];
      const lex = st.units[0] && content.lexemes.get(st.units[0].lex);
      out.push({ type: "word", text: lemmaOf(lex, st.t) });
    } else if (!inRun) {
      inRun = true;
      run = { type: "slot", labels: labels.length ? labels : ["change"], gloss: [], patterns };
      out.push(run);
    }
    if (!matched.has(j)) {
      for (const m of glossUnits(tok, content, hints)) {
        const lex = content.lexemes.get(m.lex);
        if (lex) run.gloss.push(leipzigFor(lex, m.form));
      }
    }
  });
  return out;
}

/** `(lex, form)` units for a result token: the source target lexemes' own forms first, then the form index. */
function glossUnits(tok, content, hints) {
  const key = tokenKey(tok);
  const own = [];
  for (const h of hints) {
    for (const [form, text] of Object.entries(content.lexemes.get(h.lex)?.forms ?? {})) {
      if (tokenKey(text) === key && !own.some((m) => m.lex === h.lex && m.form === form)) own.push({ lex: h.lex, form });
    }
  }
  const exact = own.filter((m) => hints.some((h) => h.lex === m.lex && h.form === m.form));
  if (own.length === 1) return own;
  if (exact.length === 1) return exact;
  return lookupToken(tok, content, hints) ?? [];
}

const formIndexCache = new WeakMap();
function formIndex(content) {
  let idx = formIndexCache.get(content);
  if (!idx) {
    idx = new Map();
    for (const l of content.lexemes.values()) {
      for (const [form, text] of Object.entries(l.forms ?? {})) {
        const key = tokenKey(text);
        if (!idx.has(key)) idx.set(key, []);
        idx.get(key).push({ lex: l.id, form });
      }
    }
    formIndexCache.set(content, idx);
  }
  return idx;
}

/**
 * One match out of several: prefer the exact lexeme-form the source's target tokens already carry (a negation
 * keeps the person), then a unique lexeme among them. `null` when still ambiguous.
 */
function resolve(matches, hints) {
  if (matches.length === 1) return matches[0];
  const exact = matches.filter((m) => hints.some((h) => h.lex === m.lex && h.form === m.form));
  if (exact.length === 1) return exact[0];
  const sameLex = matches.filter((m) => hints.some((h) => h.lex === m.lex));
  return sameLex.length === 1 ? sameLex[0] : null;
}

/** Lexicon units for one result token: one resolved match, or each part of a clitic cluster; else `null`. */
function lookupToken(tok, content, hints) {
  const idx = formIndex(content);
  const whole = resolve(idx.get(tokenKey(tok)) ?? [], hints);
  if (whole) return [whole];
  if (!tok.includes("-")) return null;
  const parts = tok.split("-").filter(Boolean).map((p) => resolve(idx.get(tokenKey(p)) ?? [], hints));
  return parts.length > 1 && parts.every(Boolean) ? parts : null;
}

/**
 * Units a transform card exercises, as `{u, lx}`: lexeme-form units for the result tokens that differ from the
 * source (found by form match; skipped when ambiguous), plus the `pat:` units of the patterns involved.
 */
export function transformUnits(sentence, transform, content) {
  const res = tokenize(transform.ro);
  const matched = new Set(alignTokens(sentence.tokens.map((t) => t.t), res).map(([, j]) => j));
  const out = new Map();
  const changed = [];
  const hints = (transform.targetTokens ?? []).flatMap((i) => sentence.tokens[i]?.units ?? []);
  res.forEach((tok, j) => {
    if (matched.has(j)) return;
    for (const m of lookupToken(tok, content, hints) ?? []) {
      changed.push(m);
      out.set(`${m.lex}.${m.form}`, { u: `${m.lex}.${m.form}`, lx: m.lex });
    }
  });
  const fallbackLx = changed[0]?.lex
    ?? sentence.tokens[transform.targetTokens?.[0]]?.units[0]?.lex
    ?? sentence.tokens[0]?.units[0]?.lex ?? "";
  for (const id of transformPatterns(sentence, transform, content)) {
    const head = sentence.tokens.flatMap((t) => t.units).find((u) => u.pattern === id && u.head);
    out.set(`pat:${id}`, { u: `pat:${id}`, lx: head?.lex ?? fallbackLx });
  }
  return [...out.values()];
}

const DRILL_WEIGHT = { xf: 0, cz: 1, sb: 2, er: 3 };

/**
 * PRD FR-D9: when a sentence has a due `xf` or `sb` card, only the best-weighted drill card
 * (`xf` > `cz` > `sb` > `er`; earlier wins ties) survives for that sentence. Other card types and
 * sentences without `xf`/`sb` are untouched.
 */
export function pickPerSentence(cardIds) {
  const groups = new Map();
  for (const id of cardIds) {
    const p = parseCardId(id);
    if (!(p.type in DRILL_WEIGHT)) continue;
    if (!groups.has(p.sentenceId)) groups.set(p.sentenceId, []);
    groups.get(p.sentenceId).push({ id, type: p.type });
  }
  const drop = new Set();
  for (const g of groups.values()) {
    if (!g.some((c) => c.type === "xf" || c.type === "sb")) continue;
    const best = g.reduce((b, c) => (DRILL_WEIGHT[c.type] < DRILL_WEIGHT[b.type] ? c : b));
    for (const c of g) if (c !== best) drop.add(c.id);
  }
  return cardIds.filter((id) => !drop.has(id));
}

/**
 * New `xf`/`sb` cards to introduce: per seen sentence (oldest first) at most one, the first unlocked
 * not-yet-introduced `xf`, else `sb`; at most `cap` in total; sentences in `skip` are left alone.
 */
export function newTransformCards(state, content, { cap = XF_PER_SESSION, skip = new Set() } = {}) {
  const seen = Object.entries(state.seenSentences)
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  const out = [];
  for (const [sid] of seen) {
    if (out.length >= cap) break;
    const s = content.sentences.get(sid);
    if (!s?.transforms?.length || skip.has(sid)) continue;
    const idxs = s.transforms.map((_, i) => i);
    const xf = idxs.find((i) => !(buildCardId("xf", sid, i) in state.cards) && xfUnlocked(s, i, state, content));
    if (xf != null) { out.push(buildCardId("xf", sid, xf)); continue; }
    const sb = idxs.find((i) => !(buildCardId("sb", sid, i) in state.cards) && sbUnlocked(s, i, state, content));
    if (sb != null) out.push(buildCardId("sb", sid, sb));
  }
  return out;
}

export const ER_STABILITY_DAYS = 7;
export const ER_PER_SESSION = 3;

/** FR-D6: the sentence has cloze units and each one's `fm` card has stability ≥ 7 days. */
export function erUnlocked(sentence, state) {
  const units = clozeUnitIds(sentence);
  return units.length > 0 && units.every((u) => (state.cards[fmIdForUnit(u)]?.stability ?? 0) >= ER_STABILITY_DAYS);
}

/** Units an `er` card exercises, as `{u, lx}`: every unit of each cloze token, plus the pattern of each head unit. */
export function erUnits(sentence) {
  const out = new Map();
  for (const t of sentence.tokens) {
    for (const u of t.units) {
      if (t.cloze) out.set(`${u.lex}.${u.form}`, { u: `${u.lex}.${u.form}`, lx: u.lex });
      if (u.pattern && u.head) out.set(`pat:${u.pattern}`, { u: `pat:${u.pattern}`, lx: u.lex });
    }
  }
  return [...out.values()];
}

/** New `er` cards to introduce: seen sentences (oldest first) with `er` unlocked and not yet introduced; at most `cap`. */
export function newErCards(state, content, { cap = ER_PER_SESSION, skip = new Set() } = {}) {
  const seen = Object.entries(state.seenSentences)
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : 1));
  const out = [];
  for (const [sid] of seen) {
    if (out.length >= cap) break;
    const s = content.sentences.get(sid);
    const id = buildCardId("er", sid);
    if (!s || skip.has(sid) || id in state.cards || !erUnlocked(s, state)) continue;
    out.push(id);
  }
  return out;
}

/**
 * `lr` is always unlocked; `fm` while its lexeme and form exist (it is only created once a sentence or key form unlocked it);
 * legacy `cz` once the sentence's `lr` card exists; legacy `kf` once its lexeme was met in ≥2 sentences;
 * `xf` / `sb` per FR-D4 / D5; `er` per FR-D6.
 */
export function isUnlocked(cardId, state, content) {
  let p;
  try { p = parseCardId(cardId); } catch { return false; }
  if (p.type === "fm") {
    const l = content.lexemes.get(p.lexemeId);
    return !!l && (p.formKey === "base" || !!l.forms?.[p.formKey]);
  }
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
  if (p.type === "xf") return xfUnlocked(sentence, p.transformIndex, state, content);
  if (p.type === "sb") return sbUnlocked(sentence, p.transformIndex, state, content);
  if (p.type === "er") return erUnlocked(sentence, state);
  return false;
}
