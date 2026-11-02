// Situations / Patterns lists: learned · learning · to learn per topic; tapping a row sets the session focus (PRD P-9, FR-N2, FR-S8).
import { renderList } from "../components/topic-list.js";
import { SITUATION_NAMES, situationName, readyCount, progressCounts, listRows, focusParam, parseFocusParam, toggleFocus } from "../models/lists.js";

// The pure model lives in ui/models/lists.js (Q13); re-exported here for one release.
export { SITUATION_NAMES, situationName, readyCount, progressCounts, listRows, focusParam, parseFocusParam, toggleFocus, renderList };

export function render(root, ctx) {
  const tab = ctx.route?.params?.tab === "patterns" ? "patterns" : "situations";
  root.innerHTML = `<h1>Choose focus</h1>
    <p class="muted">Tap topics to focus your sessions on them; tap again to remove.</p>
    <div class="row tabs" role="tablist">
      <a class="chip" role="tab" href="#/lists?tab=situations" aria-pressed="${tab === "situations"}" aria-selected="${tab === "situations"}">Situations</a>
      <a class="chip" role="tab" href="#/lists?tab=patterns" aria-pressed="${tab === "patterns"}" aria-selected="${tab === "patterns"}">Patterns</a>
    </div><div data-list></div>
    <a class="btn secondary block" href="#/home">Home</a>`;
  renderList(root.querySelector("[data-list]"), ctx, tab);
}
