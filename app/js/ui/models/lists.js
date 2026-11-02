// Situations / Patterns lists: learned · learning · to learn per topic; tapping a row sets the session focus (PRD P-9, FR-N2, FR-S8).
import { pickNewSentences, focusList } from "../../core/select.js";
import { allPatternStates, masteredSentenceIds } from "../../core/mastery.js";

export const SITUATION_NAMES = {
  standup: "Stand-up",
  decisions: "Decisions",
  coaching: "Coaching",
  domain: "Domain talk",
  table: "At the table",
  me: "About me",
  "getting-to-know": "Getting to know you",
  news: "News",
  meta: "Meta-language",
};
export const situationName = (id) => SITUATION_NAMES[id] ?? id;

const matches = (s, focus) => focusList(focus).some((f) =>
  (f.type === "pattern" ? (s.patterns ?? []) : (s.situations ?? [])).includes(f.id));

/** How many unseen sentences for `focus` (one topic or a list) the i+1 engine would offer right now (0 when blocked). */
export function readyCount(focus, { state, content, now }) {
  const pick = pickNewSentences(Infinity, { focus, state, content, now, rng: () => 0.5 });
  if (pick.blocked) return 0;
  return pick.sentences.filter((id) => matches(content.sentences.get(id), focus)).length;
}

/** Sentence progress for a topic: learned (mastered), learning (seen, not yet mastered), toLearn (unseen). */
export function progressCounts(ids, state, mastered) {
  let learned = 0;
  let learning = 0;
  for (const id of ids) {
    if (mastered.has(id)) learned++;
    else if (id in state.seenSentences) learning++;
  }
  return { learned, learning, toLearn: ids.length - learned - learning, total: ids.length };
}

/** Pure row model for both tabs. Patterns are ordered by stage; `needs` lists unmet prerequisite names. */
export function listRows(tab, { state, content, now }) {
  const mastered = new Set(masteredSentenceIds(state, content, now));
  if (tab === "situations") {
    return [...content.sentencesBySituation.keys()].map((id) => ({
      type: "situation", id, name: situationName(id), ...progressCounts(content.sentencesBySituation.get(id), state, mastered),
    }));
  }
  const states = allPatternStates(state, content, now);
  const seen = (id) => (states[id] ?? "not-started") !== "not-started";
  return [...content.patterns.values()]
    .sort((a, b) => a.stage - b.stage || (a.id < b.id ? -1 : 1))
    .map((p) => {
      const needs = (p.requires ?? []).filter((r) => !seen(r)).map((r) => content.patterns.get(r)?.name ?? r);
      return {
        type: "pattern", id: p.id, name: p.name, stage: p.stage, state: states[p.id] ?? "not-started", needs,
        ...progressCounts(content.sentencesByPattern.get(p.id) ?? [], state, mastered),
      };
    });
}

export const sameTopic = (a, b) => a.type === b.type && a.id === b.id;

/** Session route parameter for a focus list: `f=situation:standup,pattern:pres-1sg` (FR-S8). */
export function focusParam(focus) {
  return focus.length ? `&f=${encodeURIComponent(focus.map((f) => `${f.type}:${f.id}`).join(","))}` : "";
}

/** Focus list from session route params: `f=type:id,…`, or the older single `type` + `id`. */
export function parseFocusParam(params) {
  const ok = (t) => t === "situation" || t === "pattern";
  if (params.f) {
    return params.f.split(",").map((x) => {
      const i = x.indexOf(":");
      return { type: x.slice(0, i), id: x.slice(i + 1) };
    }).filter((f) => ok(f.type) && f.id);
  }
  return ok(params.type) && params.id ? [{ type: params.type, id: params.id }] : [];
}

/** Toggle one topic in a focus list (several can be on at once). */
export function toggleFocus(focus, topic) {
  return focus.some((f) => sameTopic(f, topic)) ? focus.filter((f) => !sameTopic(f, topic)) : [...focus, topic];
}
