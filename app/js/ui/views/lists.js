// Situations / Patterns lists: learned · learning · to learn per topic; tapping a row sets the session focus (PRD P-9, FR-N2, FR-S8).
import { pickNewSentences } from "../../core/select.js";
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

const matches = (s, focus) =>
  focus.type === "pattern" ? (s.patterns ?? []).includes(focus.id) : (s.situations ?? []).includes(focus.id);

/** How many unseen sentences for `focus` the i+1 engine would offer right now (0 when blocked). */
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

const sameFocus = (a, b) => !!a && !!b && a.type === b.type && a.id === b.id;

function rowEl(r, selected, onToggle) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "list-row" + (r.needs?.length ? " dim" : "");
  row.setAttribute("aria-pressed", String(selected));
  row.addEventListener("click", () => onToggle(selected ? null : { type: r.type, id: r.id }));
  const name = document.createElement("span");
  name.className = "list-name";
  name.textContent = r.name;
  if (r.type === "pattern") {
    const chip = document.createElement("span");
    chip.className = `state-chip st-${r.state}`;
    chip.textContent = r.state.replace("-", " ");
    name.append(" ", chip);
  }
  const meta = document.createElement("span");
  meta.className = "muted list-meta";
  const bar = document.createElement("span");
  bar.className = "bar stacked";
  bar.setAttribute("role", "img");
  bar.setAttribute("aria-label", `${r.learned} learned, ${r.learning} learning, ${r.toLearn} to learn`);
  for (const [cls, n] of [["learned", r.learned], ["learning", r.learning]]) {
    const seg = document.createElement("span");
    seg.className = cls;
    seg.style.width = `${(n / Math.max(r.total, 1)) * 100}%`;
    bar.append(seg);
  }
  const counts = document.createElement("span");
  counts.textContent = `${r.learned} learned · ${r.learning} learning · ${r.toLearn} to learn`;
  meta.append(bar, counts);
  row.append(name, meta);
  if (r.needs?.length) {
    const needs = document.createElement("span");
    needs.className = "muted list-meta";
    needs.textContent = `needs ${r.needs.join(", ")} first`;
    row.append(needs);
  }
  return row;
}

/**
 * Render a tab's rows into `root` (no heading). Tapping a row toggles it as the session focus
 * (`settings.focus`, saved) and calls `onChange(focus)`. Used by home and the #/lists route.
 */
export function renderList(root, ctx, tab, onChange = () => {}) {
  const rows = listRows(tab, { state: ctx.state, content: ctx.content, now: Date.now() });
  const list = document.createElement("div");
  list.className = "list";
  const toggle = (focus) => {
    ctx.state = { ...ctx.state, settings: { ...ctx.state.settings, focus } };
    ctx.store.save(ctx.state);
    renderList(root, ctx, tab, onChange);
    onChange(focus);
  };
  let stage = null;
  for (const r of rows) {
    if (tab === "patterns" && r.stage !== stage) {
      stage = r.stage;
      const h = document.createElement("h3");
      h.textContent = `Stage ${stage}`;
      list.append(h);
    }
    list.append(rowEl(r, sameFocus(ctx.state.settings.focus, r), toggle));
  }
  root.replaceChildren(list);
}

export function render(root, ctx) {
  const tab = ctx.route?.params?.tab === "patterns" ? "patterns" : "situations";
  root.innerHTML = `<h1>Choose focus</h1>
    <p class="muted">Tap a topic to focus your sessions on it; tap it again to clear.</p>
    <div class="row tabs" role="tablist">
      <a class="chip" role="tab" href="#/lists?tab=situations" aria-pressed="${tab === "situations"}" aria-selected="${tab === "situations"}">Situations</a>
      <a class="chip" role="tab" href="#/lists?tab=patterns" aria-pressed="${tab === "patterns"}" aria-selected="${tab === "patterns"}">Patterns</a>
    </div><div data-list></div>
    <a class="btn secondary block" href="#/home">Home</a>`;
  renderList(root.querySelector("[data-list]"), ctx, tab);
}
