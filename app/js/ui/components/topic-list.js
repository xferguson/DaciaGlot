// Situations / Patterns topic list (PRD P-9, FR-N2, FR-S8): rows set the session focus. Used by home and the lists view.
import { listRows, toggleFocus, sameTopic } from "../models/lists.js";

function rowEl(r, selected, onToggle) {
  const row = document.createElement("button");
  row.type = "button";
  row.className = "list-row" + (r.needs?.length ? " dim" : "");
  row.setAttribute("aria-pressed", String(selected));
  row.addEventListener("click", () => onToggle({ type: r.type, id: r.id }));
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
 * Render a tab's rows into `root` (no heading). Tapping a row adds it to or removes it from the session
 * focus (`settings.focus`, a list, saved) and calls `onChange(focus)`. Used by home and the #/lists route.
 */
export function renderList(root, ctx, tab, onChange = () => {}) {
  const rows = listRows(tab, { state: ctx.state, content: ctx.content, now: Date.now() });
  const list = document.createElement("div");
  list.className = "list";
  const toggle = (topic) => {
    const focus = toggleFocus(ctx.state.settings.focus ?? [], topic);
    ctx.updateSettings({ focus });
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
    list.append(rowEl(r, (ctx.state.settings.focus ?? []).some((f) => sameTopic(f, r)), toggle));
  }
  root.replaceChildren(list);
}
