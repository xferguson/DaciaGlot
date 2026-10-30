import { dueInFocus, mixPlan, QUICK_CAP, SEC_PER_REVIEW, SEC_PER_NEW } from "../../core/session.js";
import { levelProgress } from "../../core/mastery.js";
import { ring } from "../components/ring.js";
import { currentLevelId } from "./dashboard.js";
import { renderList, readyCount, situationName, focusParam } from "./lists.js";

/** "≈ N min" for a session of `reviews` due cards and `fresh` new sentences (the PRD FR-S7 rates). */
function minutes(reviews, fresh) {
  return `≈ ${Math.max(1, Math.round((reviews * SEC_PER_REVIEW + fresh * SEC_PER_NEW) / 60))} min`;
}

let activeTab = null;

export function render(root, ctx) {
  root.innerHTML = `
    <h1>DaciaGlot</h1>
    <p class="muted" lang="ro">Hai să vorbim românește.</p>
    <section class="card" data-modes></section>
    <section aria-label="Choose focus">
      <h2>Focus</h2>
      <p class="muted">Tap topics to keep your sessions on them. Tap again to remove.</p>
      <div class="row tabs" role="tablist">
        <button class="chip" role="tab" data-tab="situations">Situations</button>
        <button class="chip" role="tab" data-tab="patterns">Patterns</button>
      </div>
      <div data-list></div>
    </section>
    <section class="card" aria-label="Level progress" data-level></section>
    <a class="btn secondary block" href="#/settings">Settings</a>`;

  // Mode buttons, filtered by `settings.focus` (FR-S8, FR-S10). Re-rendered when the focus changes.
  const modes = root.querySelector("[data-modes]");
  const renderModes = () => {
    const focus = ctx.content ? ctx.state.settings.focus ?? [] : [];
    const now = Date.now();
    const due = ctx.content ? dueInFocus(ctx.state, ctx.content, now, focus).length : 0;
    const full = ctx.state.settings.newPerSession;
    const avail = focus.length ? Math.min(full, readyCount(focus, { state: ctx.state, content: ctx.content, now })) : full;
    const newCount = Math.min(avail, mixPlan(due, full).newCount);
    const mixSub = !newCount ? (due ? "all review" : "nothing yet") : due ? `${due} due + ${newCount} new` : `up to ${newCount} new`;
    const quickN = Math.min(due, QUICK_CAP);
    const q = focusParam(focus);
    modes.innerHTML = `
      <div class="focus-chip" data-focus-chip hidden><span>Focus: <strong data-focus-name></strong></span>
        <button class="btn secondary icon" type="button" data-clear aria-label="Clear focus">×</button></div>
      <p><strong data-due>${due}</strong> cards due${focus.length ? " in this focus" : ""}</p>
      <div class="modes">
        <a class="btn mode" href="#/session?mode=mix${q}">Mix<small>${mixSub}</small><small>${due || newCount ? minutes(due, newCount) : "–"}</small></a>
        <a class="btn secondary mode" href="#/session?mode=quick${q}">Quick<small>${quickN ? `${quickN} due` : "nothing due"}</small><small>${quickN ? `≤ ${Math.min(5, Math.max(1, Math.round((quickN * SEC_PER_REVIEW) / 60)))} min` : "–"}</small></a>
        <a class="btn secondary mode" href="#/session?mode=learn${q}">Learn<small>${avail ? `up to ${avail} new` : "nothing new yet"}</small><small>${avail ? minutes(0, avail) : "–"}</small></a>
        <a class="btn secondary mode" href="#/session?mode=review${q}">Review<small>${due ? `all ${due} due` : "nothing due"}</small><small>${due ? minutes(due, 0) : "–"}</small></a>
      </div>`;
    if (focus.length) {
      modes.querySelector("[data-focus-chip]").hidden = false;
      modes.querySelector("[data-focus-name]").textContent = focus
        .map((f) => (f.type === "pattern" ? ctx.content.patterns.get(f.id)?.name ?? f.id : situationName(f.id)))
        .join(", ");
      modes.querySelector("[data-clear]").addEventListener("click", () => {
        ctx.state = { ...ctx.state, settings: { ...ctx.state.settings, focus: [] } };
        ctx.store.save(ctx.state);
        renderModes();
        show(activeTab);
      });
    }
  };

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
    if (ctx.content) renderList(slot, ctx, tab, renderModes);
  };
  for (const b of tabs) b.addEventListener("click", () => show(b.dataset.tab));
  activeTab ??= ctx.state.settings.focus?.[0]?.type === "pattern" ? "patterns" : "situations";
  renderModes();
  show(activeTab);
}
