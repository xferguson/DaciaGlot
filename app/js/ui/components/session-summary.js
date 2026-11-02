// Session summary card (PRD FR-P6, T36): renders a `summarize` result from ui/models/summary.js.
import { tulip } from "./ornament.js";
import { html } from "../dom.js";

/** Pace block (T36, FR-V5): what came in this session and how fast, against the target. Learner-only, local. */
function paceBlock(box, { pace, target }, nameOf) {
  if (!pace) { box.hidden = true; return; }
  const add = (markup) => { const p = document.createElement("p"); p.innerHTML = markup; box.append(p); };
  if (!pace.newForms && !pace.newSentences) {
    add("<strong>Review session</strong>: nothing new this time.");
    return;
  }
  const first = pace.newPatterns[0];
  add(html`New this session: <strong>${pace.newForms}</strong> words · <strong>${pace.newSentences}</strong> sentences${first ? html` · first <em>${nameOf(first)}</em>` : ""}`);
  add(html`<strong>${(Math.round(pace.perTen * 10) / 10).toString()}</strong> per 10 min (target ${target})`);
}

/** Render the summary into `root`. `onMore` starts another Quick session. */
export function renderSummary(root, { summary, content, onMore }) {
  const nameOf = (id) => content.patterns.get(id)?.name ?? id;
  root.innerHTML = `<h1>Done!</h1>
    ${tulip()}<p class="bravo" lang="ro">Bravo!</p>
    <section class="card" data-pace></section>
    <section class="card">
      <p><strong data-n="cards"></strong> cards · <strong data-n="correct"></strong> correct</p>
      <p><span data-n="new"></span> new sentences · <span data-n="forms"></span> forms produced</p>
      <p data-difficult hidden><span data-n="difficult"></span> added to your Difficult list</p>
    </section>
    <section class="card" data-changes hidden><h2>Pattern progress</h2><ul></ul></section>
    <button class="btn block" data-more>One more Quick</button>
    <a class="btn secondary block" href="#/home">Home</a>`;
  paceBlock(root.querySelector("[data-pace]"), summary, nameOf);
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
