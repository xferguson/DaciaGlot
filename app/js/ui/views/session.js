// Study loop: Quick / Mix / Learn / Review / Focus (PRD FR-S2…S9). Renders T07 cards one after another.
import { buildSession, SEC_PER_REVIEW, gradeFromResult, applyReview, addMinutes, requeueWrong } from "../../core/session.js";
import { parseCardId, exampleSentenceFor } from "../../core/cards.js";
import { unitsRequiredForCard } from "../../core/units.js";
import { renderCard as renderLr } from "./card-lr.js";
import { renderCard as renderCz } from "./card-cloze.js";
import { renderCard as renderKf } from "./card-keyform.js";
import { renderCard as renderXf } from "./card-transform.js";
import { renderCard as renderSb } from "./card-slot.js";
import { renderCard as renderEr } from "./card-enro.js";
import { toast } from "../components/toast.js";
import { flagButton } from "../components/flag-button.js";
import { situationName } from "./lists.js";
import { allPatternStates } from "../../core/mastery.js";
import { summarize, renderSummary } from "./summary.js";

const QUICK_MS = 5 * 60 * 1000;
const MODES = ["quick", "mix", "learn", "review"];
const TITLES = { quick: "Quick", mix: "Mix", learn: "Learn", review: "Review", session: "Session" };
const EMPTY = {
  learn: "No new sentences are ready right now. Review what's due and they'll unlock.",
  review: "Nothing is due. Nice work.",
};
const RENDERERS = { lr: renderLr, cz: renderCz, kf: renderKf, xf: renderXf, sb: renderSb, er: renderEr };

export function render(root, ctx) {
  const params = ctx.route?.params ?? {};
  // Old links (`mode=session`) open Mix; focus sessions keep the full `newPerSession` (FR-S8).
  const mode = MODES.includes(params.mode) ? params.mode : params.mode === "focus" ? "session" : "mix";
  const focus = params.mode === "focus" && (params.type === "pattern" || params.type === "situation") && params.id
    ? { type: params.type, id: params.id }
    : null;
  const { queue, estimateSec, blocked, suggest, plan } = buildSession({
    mode, focus, state: ctx.state, content: ctx.content, now: Date.now(), rng: Math.random,
  });
  let cardCleanup = null;
  let alive = true;
  let pos = 0;
  let startedAt = 0;
  const stats = { cards: 0, correct: 0, newSentences: 0 };
  const done = new Set();
  const patternsBefore = allPatternStates(ctx.state, ctx.content, Date.now());

  const home = `<a class="btn secondary block" href="#/home">Home</a>`;

  const focusName = () => (focus.type === "pattern" ? ctx.content.patterns.get(focus.id)?.name : situationName(focus.id)) ?? focus.id;

  function blockedNote() {
    if (!blocked) return "";
    const href = suggest && `#/session?mode=focus&type=${suggest.type}&id=${encodeURIComponent(suggest.id)}`;
    return `<section class="card"><p>No new sentences are ready for <strong data-focus></strong> yet.</p>
      ${suggest ? `<a class="btn block" href="${href}">Study <span data-suggest></span> first</a>` : ""}</section>`;
  }

  function fillNames() {
    const f = root.querySelector("[data-focus]");
    if (f) f.textContent = focusName();
    const s = root.querySelector("[data-suggest]");
    if (s) s.textContent = suggest.type === "pattern" ? ctx.content.patterns.get(suggest.id)?.name ?? suggest.id : situationName(suggest.id);
  }

  function start() {
    if (blocked) {
      root.innerHTML = `<h1>Focus</h1>${blockedNote()}${queue.length ? `<button class="btn secondary block" data-due>Review ${queue.length} due cards</button>` : ""}${home}`;
      fillNames();
      root.querySelector("[data-due]")?.addEventListener("click", begin);
      return;
    }
    if (!queue.length) {
      root.innerHTML = `<h1>${TITLES[mode]}</h1>
        <p class="muted">${EMPTY[mode] ?? "Nothing to study right now."}</p>${home}`;
      return;
    }
    if (mode === "quick") return begin();
    const mins = Math.max(1, Math.round(estimateSec / 60));
    const fresh = queue.filter((q) => q.isNew && q.cardId.startsWith("lr:")).length;
    const forms = queue.filter((q) => q.isNew && q.cardId.startsWith("kf:")).length;
    const drills = queue.filter((q) => q.isNew && /^(xf|sb|er):/.test(q.cardId)).length;
    const reviews = queue.filter((q) => !q.isNew).length;
    root.innerHTML = `<h1>${focus ? "Focus: <span data-focus></span>" : TITLES[mode]}</h1>
      <section class="card"><p>${queue.length} cards · ${mode === "learn" ? "" : `${reviews} reviews · `}${fresh} new sentence${fresh === 1 ? "" : "s"}${forms ? ` · ${forms} new forms` : ""}${drills ? ` · ${drills} new drills` : ""}</p>
      ${plan ? `<p>${mixNote(plan, reviews, ctx.state.settings.newPerSession)}</p>` : ""}
      <p class="muted">≈ ${mins} min</p>
      <button class="btn block" data-start>Start</button></section>${home}`;
    fillNames();
    root.querySelector("[data-start]").addEventListener("click", begin);
  }

  function mixNote({ newCount }, reviews, full) {
    const reviewPct = Math.round((100 * reviews * SEC_PER_REVIEW) / Math.max(estimateSec, 1));
    const split = `≈ ${reviewPct}% review · ${100 - reviewPct}% new.`;
    if (newCount >= full) return `${split} Light review load, so up to ${full} new sentences.`;
    if (newCount > 0) return `${split} ${reviews} reviews due, so only ${newCount} new sentences today.`;
    return `All review today: ${reviews} cards are due. Catch up first, or use Learn for new material anyway.`;
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
    const summary = summarize({
      before: patternsBefore, state: ctx.state, content: ctx.content, stats, startedAt, now: Date.now(),
    });
    renderSummary(root, { summary, content: ctx.content, onMore: () => ctx.navigate("#/session?mode=quick") });
    alive = false;
  }

  start();
  return () => {
    alive = false;
    if (typeof cardCleanup === "function") cardCleanup();
    ctx.store.flush();
  };
}
