import { dueCount } from "../../core/session.js";

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
    <section class="card" aria-label="Level progress">
      <div class="ring" role="img" aria-label="Level progress placeholder">A1</div>
      <p class="muted" style="text-align:center">Level progress coming soon</p>
    </section>
    <a class="btn secondary block" href="#/settings">Settings</a>`;
}
