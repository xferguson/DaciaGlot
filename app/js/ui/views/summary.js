// End-of-session summary (PRD FR-P6) and the export reminder rule (FR-X4).
// The helpers are pure so they can be tested without a DOM.
import { tulip } from "../components/ornament.js";
import { allPatternStates } from "../../core/mastery.js";

const DAY = 86400000;
export const EXPORT_REMINDER_DAYS = 14;
export const EXPORT_REMINDER_MIN_STUDY_DAYS = 3;

/** Patterns whose state differs between two `allPatternStates` maps → `{id, from, to}[]`. */
export function diffPatternStates(before, after) {
  return Object.keys(after)
    .filter((id) => (before[id] ?? "not-started") !== after[id])
    .map((id) => ({ id, from: before[id] ?? "not-started", to: after[id] }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Distinct units answered correctly at or after `since` (ms epoch). */
export function formsProduced(attempts, since) {
  return new Set(attempts.filter((a) => a.c === 1 && !a.enc && a.t >= since).map((a) => a.u)).size;
}

/**
 * Banner rule: `lastExportAt` null → after the 3rd day of study; otherwise once it is older than 14 days.
 * (Sessions aren't recorded individually, so days with ≥1 card stand in for sessions.)
 */
export function exportReminderDue(state, now) {
  const last = state.settings.lastExportAt;
  if (last == null) {
    const days = Object.values(state.history).filter((d) => d.cards > 0).length;
    return days >= EXPORT_REMINDER_MIN_STUDY_DAYS;
  }
  return now - last > EXPORT_REMINDER_DAYS * DAY;
}

export function summarize({ before, state, content, stats, startedAt, now }) {
  return {
    cards: stats.cards,
    correct: stats.correct,
    newSentences: stats.newSentences,
    difficult: stats.difficult ?? 0,
    forms: formsProduced(state.attempts, startedAt),
    changes: diffPatternStates(before, allPatternStates(state, content, now)),
  };
}

/** Render the summary into `root`. `onMore` starts another Quick session. */
export function renderSummary(root, { summary, content, onMore }) {
  const nameOf = (id) => content.patterns.get(id)?.name ?? id;
  root.innerHTML = `<h1>Done!</h1>
    ${tulip()}<p class="bravo" lang="ro">Bravo!</p>
    <section class="card">
      <p><strong data-n="cards"></strong> cards · <strong data-n="correct"></strong> correct</p>
      <p><span data-n="new"></span> new sentences · <span data-n="forms"></span> forms produced</p>
      <p data-difficult hidden><span data-n="difficult"></span> added to your Difficult list</p>
    </section>
    <section class="card" data-changes hidden><h2>Pattern progress</h2><ul></ul></section>
    <button class="btn block" data-more>One more Quick</button>
    <a class="btn secondary block" href="#/home">Home</a>`;
  const set = (k, v) => { root.querySelector(`[data-n="${k}"]`).textContent = v; };
  set("cards", summary.cards);
  set("correct", summary.correct);
  set("new", summary.newSentences);
  set("forms", summary.forms);
  if (summary.difficult) {
    root.querySelector("[data-difficult]").hidden = false;
    set("difficult", summary.difficult === 1 ? "1 card" : `${summary.difficult} cards`);
  }
  if (summary.changes.length) {
    const box = root.querySelector("[data-changes]");
    box.hidden = false;
    for (const c of summary.changes) {
      const li = document.createElement("li");
      li.textContent = `${nameOf(c.id)}: ${c.from} → ${c.to}`;
      box.querySelector("ul").append(li);
    }
  }
  root.querySelector("[data-more]").addEventListener("click", onMore);
}

export function render(root, ctx) {
  root.innerHTML = `<h1>Summary</h1><p class="muted">Finish a session to see its summary.</p><a class="btn secondary block" href="#/home">Home</a>`;
}
