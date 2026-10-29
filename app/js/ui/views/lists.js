// Situations / Patterns lists with live readiness (PRD P-9, FR-S8; ARCHITECTURE §6.2).
import { pickNewSentences } from "../../core/select.js";
import { allPatternStates } from "../../core/mastery.js";

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

const matches = (s, focus) =>
  focus.type === "pattern" ? (s.patterns ?? []).includes(focus.id) : (s.situations ?? []).includes(focus.id);

/** How many unseen sentences for `focus` the i+1 engine would offer right now (0 when blocked). */
export function readyCount(focus, { state, content, now }) {
  const pick = pickNewSentences(Infinity, { focus, state, content, now, rng: () => 0.5 });
  if (pick.blocked) return 0;
  return pick.sentences.filter((id) => matches(content.sentences.get(id), focus)).length;
}

/** Pure row model for both tabs. Patterns are ordered by stage; `needs` lists unmet prerequisite names. */
export function listRows(tab, { state, content, now }) {
  const ctx = { state, content, now };
  if (tab === "situations") {
    return [...content.sentencesBySituation.keys()].map((id) => {
      const ids = content.sentencesBySituation.get(id);
      const seen = ids.filter((s) => s in state.seenSentences).length;
      return { type: "situation", id, name: situationName(id), seen, total: ids.length, ready: readyCount({ type: "situation", id }, ctx) };
    });
  }
  const states = allPatternStates(state, content, now);
  const seen = (id) => (states[id] ?? "not-started") !== "not-started";
  return [...content.patterns.values()]
    .sort((a, b) => a.stage - b.stage || (a.id < b.id ? -1 : 1))
    .map((p) => {
      const needs = (p.requires ?? []).filter((r) => !seen(r)).map((r) => content.patterns.get(r)?.name ?? r);
      return { type: "pattern", id: p.id, name: p.name, stage: p.stage, state: states[p.id] ?? "not-started", needs, ready: readyCount({ type: "pattern", id: p.id }, ctx) };
    });
}

function rowEl(r) {
  const a = document.createElement("a");
  a.className = "list-row" + (r.needs?.length ? " dim" : "");
  a.href = `#/session?mode=focus&type=${r.type}&id=${encodeURIComponent(r.id)}`;
  const name = document.createElement("span");
  name.className = "list-name";
  name.textContent = r.name;
  const meta = document.createElement("span");
  meta.className = "muted list-meta";
  if (r.type === "situation") {
    const bar = document.createElement("span");
    bar.className = "bar";
    bar.setAttribute("role", "img");
    bar.setAttribute("aria-label", `${r.seen} of ${r.total} sentences seen`);
    const fill = document.createElement("span");
    fill.style.width = `${Math.round((r.seen / Math.max(r.total, 1)) * 100)}%`;
    bar.append(fill);
    meta.append(bar);
  } else {
    const chip = document.createElement("span");
    chip.className = `state-chip st-${r.state}`;
    chip.textContent = r.state.replace("-", " ");
    meta.append(chip);
  }
  const ready = document.createElement("span");
  ready.textContent = r.needs?.length ? `needs ${r.needs.join(", ")}` : `${r.ready} ready`;
  meta.append(ready);
  a.append(name, meta);
  return a;
}

/** Render a tab's rows into `root` (no heading). Used by home and the #/lists route. */
export function renderList(root, ctx, tab) {
  const rows = listRows(tab, { state: ctx.state, content: ctx.content, now: Date.now() });
  const list = document.createElement("div");
  list.className = "list";
  let stage = null;
  for (const r of rows) {
    if (tab === "patterns" && r.stage !== stage) {
      stage = r.stage;
      const h = document.createElement("h3");
      h.textContent = `Stage ${stage}`;
      list.append(h);
    }
    list.append(rowEl(r));
  }
  root.replaceChildren(list);
}

export function render(root, ctx) {
  const tab = ctx.route?.params?.tab === "patterns" ? "patterns" : "situations";
  root.innerHTML = `<h1>Choose focus</h1>
    <div class="row tabs" role="tablist">
      <a class="chip" role="tab" href="#/lists?tab=situations" aria-pressed="${tab === "situations"}" aria-selected="${tab === "situations"}">Situations</a>
      <a class="chip" role="tab" href="#/lists?tab=patterns" aria-pressed="${tab === "patterns"}" aria-selected="${tab === "patterns"}">Patterns</a>
    </div><div data-list></div>
    <a class="btn secondary block" href="#/home">Home</a>`;
  renderList(root.querySelector("[data-list]"), ctx, tab);
}
