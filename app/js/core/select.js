// i+1 selection (ARCHITECTURE §6.2, PRD FR-S5). Pure: `now` and `rng` are injected.
import { unitsForSentence, isKnown } from "./units.js";
import { allPatternStates } from "./mastery.js";

const BAND = 5;

function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

/** A focus may be one `{type, id}`, a list of them, or null; always returns a list (FR-S8). */
export function focusList(focus) {
  if (!focus) return [];
  return Array.isArray(focus) ? focus : [focus];
}

const matchesOne = (s, f) => (f.type === "pattern" ? (s.patterns ?? []) : (s.situations ?? [])).includes(f.id);
/** The first focus topic the sentence belongs to, or undefined. */
const matchedFocus = (s, focus) => focusList(focus).find((f) => matchesOne(s, f));
const matchesFocus = (s, focus) => !!matchedFocus(s, focus);

/**
 * @param {number} n
 * @param {{focus: {type: "situation"|"pattern", id: string}|{type: string, id: string}[]|null, state: object, content: object, now: number, rng: () => number}} opts
 * @returns {{sentences: string[]} | {blocked: true, suggest: {type: string, id: string}|null}}
 */
export function pickNewSentences(n, { focus: rawFocus = null, state, content, now, rng }) {
  const focus = focusList(rawFocus).length ? focusList(rawFocus) : null;
  const pstates = allPatternStates(state, content, now);
  const seenPattern = (id) => (pstates[id] ?? "not-started") !== "not-started";
  const patternStage = (id) => content.patterns.get(id)?.stage ?? 1;
  const maxSeenStage = Math.max(0, ...[...content.patterns.keys()].filter(seenPattern).map(patternStage));
  const stageCap = maxSeenStage === 0 ? 1 : maxSeenStage + 1;
  const unmetFor = (s) => {
    const out = [];
    for (const p of s.patterns ?? []) for (const r of content.patterns.get(p)?.requires ?? []) if (!seenPattern(r)) out.push(r);
    return out;
  };
  let maxFreq = 1;
  for (const l of content.lexemes.values()) if (l.freq > maxFreq) maxFreq = l.freq;

  const knownCache = new Map();
  const known = (u) => {
    if (!knownCache.has(u)) knownCache.set(u, isKnown(u, state, content));
    return knownCache.get(u);
  };

  const unseen = [...content.sentences.values()].filter(
    (s) => !(s.id in state.seenSentences) && state.settings.registers.includes(s.register) && s.stage <= stageCap,
  );
  const blockedByPrereq = [];
  const candidates = [];
  for (const s of unseen) {
    if (unmetFor(s).length) { blockedByPrereq.push(s); continue; }
    const units = unitsForSentence(s);
    const unknown = units.filter((u) => !known(u));
    if (unknown.length === 0 || unknown.length > 2) continue;
    candidates.push({ s, units, unknown });
  }

  const score = ({ s, units, unknown }) => {
    let sc = unknown.length === 1 ? 100 : 40;
    const hit = matchedFocus(s, focus);
    if (hit) {
      sc += 50;
      if (hit.type === "pattern") {
        const lexemes = new Set(units.filter((u) => !u.startsWith("pat:") && known(u)).map((u) => u.slice(0, u.indexOf("."))));
        sc += Math.min(90, 30 * lexemes.size);
      } else if (unknown.every((u) => !u.startsWith("pat:"))) sc += 30;
    }
    const freqs = units.filter((u) => !u.startsWith("pat:")).map((u) => content.lexemes.get(u.slice(0, u.indexOf(".")))?.freq).filter(Number.isFinite);
    if (freqs.length) sc += Math.round(20 * (1 - Math.max(...freqs) / maxFreq));
    sc -= 15 * (s.patterns ?? []).filter((p) => pstates[p] === "seen").length;
    return sc;
  };

  const scored = candidates
    .map((c) => ({ ...c, score: score(c) }))
    .sort((a, b) => b.score - a.score || (a.s.id < b.s.id ? -1 : 1));
  const ordered = [];
  for (let i = 0; i < scored.length; ) {
    let j = i + 1;
    while (j < scored.length && scored[i].score - scored[j].score <= BAND) j++;
    ordered.push(...shuffle(scored.slice(i, j), rng));
    i = j;
  }

  if (focus && !ordered.some((c) => matchesFocus(c.s, focus))) {
    return { blocked: true, suggest: suggestFor(focus, blockedByPrereq, candidates, unmetFor) };
  }

  const picked = [];
  const taken = new Set();
  for (const c of ordered) {
    if (picked.length >= n) break;
    if (focus && !matchesFocus(c.s, focus)) continue; // FR-S8: a focus filters, it doesn't just rank
    if (c.unknown.some((u) => taken.has(u))) continue;
    picked.push(c.s.id);
    c.unknown.forEach((u) => taken.add(u));
  }
  return { sentences: picked };
}

function mostCommon(items) {
  const counts = new Map();
  for (const x of items) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0] ?? null;
}

/** The unmet prerequisite pattern with the most focus sentences behind it, else the roomiest other situation. */
function suggestFor(focus, blockedByPrereq, candidates, unmetFor) {
  const prereq = mostCommon(blockedByPrereq.filter((s) => matchesFocus(s, focus)).flatMap((s) => [...new Set(unmetFor(s))]));
  if (prereq) return { type: "pattern", id: prereq };
  const sit = mostCommon(
    candidates.flatMap((c) => c.s.situations ?? []).filter((id) => !focus.some((f) => f.type === "situation" && f.id === id)),
  );
  return sit ? { type: "situation", id: sit } : null;
}
