// Study loop: Quick / Session (PRD FR-S2…S9). Renders T07 cards one after another.
import { buildSession, gradeFromResult, applyReview, addMinutes, requeueWrong } from "../../core/session.js";
import { parseCardId, exampleSentenceFor } from "../../core/cards.js";
import { unitsRequiredForCard } from "../../core/units.js";
import { renderCard as renderLr } from "./card-lr.js";
import { renderCard as renderCz } from "./card-cloze.js";
import { renderCard as renderKf } from "./card-keyform.js";
import { toast } from "../components/toast.js";
import { flagButton } from "../components/flag-button.js";

const QUICK_MS = 5 * 60 * 1000;
const RENDERERS = { lr: renderLr, cz: renderCz, kf: renderKf };

export function render(root, ctx) {
  const mode = ctx.route?.params?.mode === "quick" ? "quick" : "session";
  const { queue, estimateSec } = buildSession({
    mode, state: ctx.state, content: ctx.content, now: Date.now(), rng: Math.random,
  });
  let cardCleanup = null;
  let alive = true;
  let pos = 0;
  let startedAt = 0;
  const stats = { cards: 0, correct: 0, newSentences: 0 };
  const done = new Set();

  const home = `<a class="btn secondary block" href="#/home">Home</a>`;

  function start() {
    if (!queue.length) {
      root.innerHTML = `<h1>${mode === "quick" ? "Quick" : "Session"}</h1>
        <p class="muted">Nothing to study right now.</p>${home}`;
      return;
    }
    if (mode === "quick") return begin();
    const mins = Math.max(1, Math.round(estimateSec / 60));
    const fresh = queue.filter((q) => q.isNew && q.cardId.startsWith("lr:")).length;
    const forms = queue.filter((q) => q.isNew && q.cardId.startsWith("kf:")).length;
    root.innerHTML = `<h1>Session</h1>
      <section class="card"><p>${queue.length} cards · ${fresh} new sentences${forms ? ` · ${forms} new forms` : ""}</p>
      <p class="muted">≈ ${mins} min</p>
      <button class="btn block" data-start>Start</button></section>${home}`;
    root.querySelector("[data-start]").addEventListener("click", begin);
  }

  function begin() {
    startedAt = Date.now();
    root.innerHTML = `<div class="progress" role="progressbar" aria-label="Session progress"><div class="progress-fill"></div></div>
      <div data-flag style="display:flex;justify-content:flex-end"></div>
      <div data-card></div>`;
    next();
  }

  function progress() {
    const fill = root.querySelector(".progress-fill");
    if (fill) fill.style.width = `${Math.round((pos / Math.max(queue.length, 1)) * 100)}%`;
  }

  function next() {
    if (!alive) return;
    if (typeof cardCleanup === "function") cardCleanup();
    cardCleanup = null;
    const timeUp = mode === "quick" && Date.now() - startedAt >= QUICK_MS;
    if (pos >= queue.length || timeUp) return finish();
    progress();
    const item = queue[pos];
    const p = parseCardId(item.cardId);
    const sentence = p.type === "kf"
      ? exampleSentenceFor(p.lexemeId, p.formKey, ctx.state, ctx.content)
      : ctx.content.sentences.get(p.sentenceId);
    const draw = RENDERERS[p.type];
    if ((!sentence && p.type !== "kf") || !draw) { pos++; return next(); }
    const slot = root.querySelector("[data-card]");
    slot.replaceChildren();
    const flagSlot = root.querySelector("[data-flag]");
    flagSlot.replaceChildren();
    if (sentence) {
      flagSlot.replaceChildren(flagButton({
        sentenceId: sentence.id,
        isFlagged: () => ctx.state.flags.some((f) => f.sentenceId === sentence.id),
        onSave(flag) {
          ctx.state = { ...ctx.state, flags: [...ctx.state.flags, flag] };
          ctx.store.save(ctx.state);
          toast("Flagged. See Settings to report it.");
        },
      }));
    }
    cardCleanup = draw(slot, {
      card: item.cardId,
      sentence,
      content: ctx.content,
      tts: ctx.tts,
      settings: ctx.state.settings,
      onResult(r) {
        const grade = gradeFromResult(r);
        const now = Date.now();
        const seenBefore = Object.keys(ctx.state.seenSentences).length;
        ctx.state = applyReview(ctx.state, item.cardId, grade, unitsRequiredForCard(item.cardId, ctx.content), now, ctx.content);
        ctx.store.save(ctx.state);
        stats.cards++;
        if (grade > 1) stats.correct++;
        if (Object.keys(ctx.state.seenSentences).length > seenBefore) stats.newSentences++;
        if (grade === 1 && !done.has(item.cardId)) {
          done.add(item.cardId);
          requeueWrong(queue, pos, item, Math.random);
        }
        pos++;
        next();
      },
    });
  }

  function finish() {
    const minutes = (Date.now() - startedAt) / 60000;
    ctx.state = addMinutes(ctx.state, minutes, Date.now());
    ctx.store.save(ctx.state);
    ctx.store.flush();
    root.innerHTML = `<h1>Done!</h1>
      <section class="card">
        <p><strong>${stats.cards}</strong> cards reviewed · <strong>${stats.correct}</strong> correct</p>
        <p>${stats.newSentences} new sentences</p>
      </section>${home}`;
    alive = false;
  }

  start();
  return () => {
    alive = false;
    if (typeof cardCleanup === "function") cardCleanup();
    ctx.store.flush();
  };
}
