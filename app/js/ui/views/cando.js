// Can-do checklist per situation (PRD FR-P4). Embedded in the dashboard; reads ctx.state at render time.
import { canDoCheckable, canDoMastery } from "../../core/mastery.js";

const SITUATIONS = {
  standup: "Stand-up", decisions: "Decisions", coaching: "Coaching", domain: "Domain",
  table: "Table", me: "About me", "getting-to-know": "Getting to know", news: "News", meta: "Language",
};
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

/** Renders the checklist for `levelId` into `root`; `opts.now` defaults to the current time. */
export function renderCanDos(root, ctx, levelId = "A1", opts = {}) {
  const now = opts.now ?? Date.now();
  const level = ctx.content.levels.get(levelId);
  const bySituation = new Map();
  for (const c of level?.canDos ?? []) {
    if (!bySituation.has(c.situation)) bySituation.set(c.situation, []);
    bySituation.get(c.situation).push(c);
  }
  const item = (c) => {
    const checked = c.id in ctx.state.canDoChecked;
    const { done, total } = canDoMastery(c.id, ctx.state, ctx.content, now);
    const control = checked || canDoCheckable(c.id, ctx.state, ctx.content, now)
      ? `<input type="checkbox" data-id="${esc(c.id)}" ${checked ? "checked" : ""}>`
      : `<span class="muted">${done} / ${total} sentences mastered</span>`;
    return `<li><label class="check">${control}<span>${esc(c.text)}</span></label></li>`;
  };
  root.innerHTML = `<section class="card" aria-label="Can-do checklist"><h2>Can-do checklist</h2>${[...bySituation]
    .map(([sit, items]) => `<h3>${esc(SITUATIONS[sit] ?? sit)}</h3><ul class="plain">${items.map(item).join("")}</ul>`)
    .join("")}</section>`;
  root.querySelectorAll("input[data-id]").forEach((box) => {
    box.addEventListener("change", () => {
      const checkedMap = { ...ctx.state.canDoChecked };
      if (box.checked) checkedMap[box.dataset.id] = Date.now();
      else delete checkedMap[box.dataset.id];
      ctx.state = { ...ctx.state, canDoChecked: checkedMap };
      ctx.store.save(ctx.state);
    });
  });
}

export function render(root, ctx) {
  renderCanDos(root, ctx);
}
