import { dueCount, mixPlan, resumable } from "../../core/session.js";
import { levelProgress } from "../../core/mastery.js";
import { ring } from "../components/ring.js";
import { currentLevelId } from "./dashboard.js";
import { renderList } from "./lists.js";

let activeTab = "situations";

export function render(root, ctx) {
  const due = ctx.content ? dueCount(ctx.state, ctx.content, Date.now()) : 0;
  const full = ctx.state.settings.newPerSession;
  const { newCount } = mixPlan(due, full);
  const mixSub = !newCount ? "all review today" : due ? `${due} due + up to ${newCount} new` : `up to ${newCount} new`;
  root.innerHTML = `
    <h1>DaciaGlot</h1>
    <p class="muted" lang="ro">Hai să vorbim românește.</p>
    <section class="card" data-resume hidden>
      <a class="btn block" data-resume-link></a>
      <p class="muted" data-resume-left></p>
    </section>
    <section class="card">
      <p><strong data-due>${due}</strong> cards due</p>
      <div class="modes">
        <a class="btn mode" href="#/session?mode=mix">Mix<small>${mixSub}</small></a>
        <a class="btn secondary mode" href="#/session?mode=quick">Quick<small>≤ 15 due · 5 min</small></a>
        <a class="btn secondary mode" href="#/session?mode=learn">Learn<small>up to ${full} new</small></a>
        <a class="btn secondary mode" href="#/session?mode=review">Review<small>${due ? `all ${due} due` : "nothing due"}</small></a>
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
    <section class="card" aria-label="Level progress" data-level></section>
    <a class="btn secondary block" href="#/settings">Settings</a>`;
  const active = ctx.state.activeSession;
  if (resumable(active, Date.now())) {
    root.querySelector("[data-resume]").hidden = false;
    root.querySelector("[data-resume-link]").href = active.href;
    root.querySelector("[data-resume-link]").textContent = `Continue ${active.title}`;
    const left = active.queue.length - active.pos;
    root.querySelector("[data-resume-left]").textContent = `${left} card${left === 1 ? "" : "s"} to go · your progress is saved`;
  }
  const levelSlot = root.querySelector("[data-level]");
  if (ctx.content) {
    const now = Date.now();
    const progress = Object.fromEntries([...ctx.content.levels.keys()].map((id) => [id, levelProgress(id, ctx.state, ctx.content, now)]));
    const id = currentLevelId(progress);
    if (id) {
      const link = document.createElement("a");
      link.className = "ring-link";
      link.href = "#/dashboard";
      const note = document.createElement("span");
      note.className = "muted";
      note.textContent = `${Math.round(progress[id].percent)}% · see progress`;
      link.append(ring({ percent: progress[id].percent, label: id }), note);
      levelSlot.append(link);
    }
  }
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
