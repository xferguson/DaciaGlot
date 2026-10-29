import { dueCount } from "../../core/session.js";
import { renderList } from "./lists.js";

let activeTab = "situations";

export function render(root, ctx) {
  const due = ctx.content ? dueCount(ctx.state, ctx.content, Date.now()) : 0;
  root.innerHTML = `
    <h1>DaciaGlot</h1>
    <p class="muted" lang="ro">Hai să vorbim românește.</p>
    <section class="card">
      <p><strong data-due>${due}</strong> cards due</p>
      <div class="row">
        <a class="btn" href="#/session?mode=quick">Quick</a>
        <a class="btn secondary" href="#/session?mode=session">Session</a>
      </div>
    </section>
    <section aria-label="Choose focus">
      <h2>Focus</h2>
      <div class="row tabs" role="tablist">
        <button class="chip" role="tab" data-tab="situations">Situations</button>
        <button class="chip" role="tab" data-tab="patterns">Patterns</button>
      </div>
      <div data-list></div>
    </section>
    <section class="card" aria-label="Level progress">
      <div class="ring" role="img" aria-label="Level progress placeholder">A1</div>
      <p class="muted" style="text-align:center">Level progress coming soon</p>
    </section>
    <a class="btn secondary block" href="#/settings">Settings</a>`;
  const slot = root.querySelector("[data-list]");
  const tabs = [...root.querySelectorAll("[data-tab]")];
  const show = (tab) => {
    activeTab = tab;
    for (const b of tabs) {
      b.setAttribute("aria-pressed", String(b.dataset.tab === tab));
      b.setAttribute("aria-selected", String(b.dataset.tab === tab));
    }
    if (ctx.content) renderList(slot, ctx, tab);
  };
  for (const b of tabs) b.addEventListener("click", () => show(b.dataset.tab));
  show(activeTab);
}
