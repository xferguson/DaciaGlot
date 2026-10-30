// Study loop: Quick / Mix / Learn / Review / Focus (PRD FR-S2…S9). Renders T07 cards one after another.
import { buildSession, gradeFromResult, applyReview, addMinutes, requeueWrong, resumable } from "../../core/session.js";
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
  // Old links (`mode=session`, `mode=focus`) open Mix. A focus (`type` + `id`) filters any mode (FR-S8).
  const mode = MODES.includes(params.mode) ? params.mode : "mix";
  const focus = (params.type === "pattern" || params.type === "situation") && params.id
    ? { type: params.type, id: params.id }
    : null;
  // An unfinished session for the same route resumes where it stopped (AppState.activeSession).
  const href = location.hash;
  const key = focus ? `${mode}:${focus.type}:${focus.id}` : mode;
  const saved = resumable(ctx.state.activeSession, Date.now()) && ctx.state.activeSession.key === key ? ctx.state.activeSession : null;
  const { queue, blocked, suggest, plan } = saved
    ? { queue: saved.queue.map((q) => ({ ...q })) }
    : buildSession({ mode, focus, state: ctx.state, content: ctx.content, now: Date.now(), rng: Math.random });
  let cardCleanup = null;
  let alive = true;
  let pos = saved?.pos ?? 0;
  let firstStartedAt = saved?.firstStartedAt ?? 0; // wall clock of the first start, for the summary
  let elapsedMs = saved?.elapsedMs ?? 0;          // study time in earlier visits
  let segmentStart = 0;                            // start of this visit
  let finished = false;
  const stats = saved ? { ...saved.stats } : { cards: 0, correct: 0, newSentences: 0 };
  const done = new Set(saved?.done ?? []);
  const patternsBefore = saved?.before ?? allPatternStates(ctx.state, ctx.content, Date.now());

  const home = `<a class="btn secondary block" href="#/home">Home</a>`;

  const focusName = () => (focus.type === "pattern" ? ctx.content.patterns.get(focus.id)?.name : situationName(focus.id)) ?? focus.id;

  function blockedNote() {
    if (!blocked) return "";
    return `<section class="card"><p>No new sentences are ready for <strong data-focus></strong> yet.</p>
      ${suggest ? `<button class="btn block" type="button" data-switch>Focus on <span data-suggest></span> first</button>` : ""}</section>`;
  }

  function title() {
    return focus ? `${TITLES[mode]} · ${focusName()}` : TITLES[mode];
  }

  /** Keep the remaining queue in state so leaving mid-session doesn't lose the place. Caller saves. */
  function persist(now) {
    ctx.state = {
      ...ctx.state,
      activeSession: {
        key, href, title: title(), queue, pos, stats: { ...stats }, done: [...done], before: patternsBefore,
        firstStartedAt, elapsedMs: elapsedMs + (now - segmentStart), updatedAt: now,
      },
    };
  }

  function fillNames() {
    const f = root.querySelector("[data-focus]");
    if (f) f.textContent = focusName();
    const s = root.querySelector("[data-suggest]");
    if (s) s.textContent = suggest.type === "pattern" ? ctx.content.patterns.get(suggest.id)?.name ?? suggest.id : situationName(suggest.id);
  }

  function start() {
    if (saved) {
      begin();
      toast(`Picked up where you left off · ${queue.length - pos} cards to go`);
      return;
    }
    if (blocked) {
      root.innerHTML = `<h1>${TITLES[mode]}</h1>${blockedNote()}${queue.length ? `<button class="btn secondary block" data-due>Review ${queue.length} due cards</button>` : ""}${home}`;
      fillNames();
      root.querySelector("[data-due]")?.addEventListener("click", begin);
      root.querySelector("[data-switch]")?.addEventListener("click", () => {
        ctx.state = { ...ctx.state, settings: { ...ctx.state.settings, focus: suggest } };
        ctx.store.save(ctx.state);
        ctx.navigate(`#/session?mode=${mode}&type=${suggest.type}&id=${encodeURIComponent(suggest.id)}`);
      });
      return;
    }
    if (!queue.length) {
      root.innerHTML = `<h1>${TITLES[mode]}</h1>
        <p class="muted">${focus ? "Nothing in this focus right now. Clear the focus on Home or pick another topic." : EMPTY[mode] ?? "Nothing to study right now."}</p>${home}`;
      return;
    }
    begin();
    const note = plan && mixNote(plan, ctx.state.settings.newPerSession);
    if (note) toast(note);
  }

  /** Why Mix holds back new sentences; nothing to say when it gives the full set. */
  function mixNote({ newCount }, full) {
    const reviews = queue.filter((q) => !q.isNew).length;
    if (newCount >= full) return "";
    if (newCount > 0) return `${reviews} reviews due, so only ${newCount} new sentences today.`;
    return `All review today: ${reviews} cards are due. Use Learn for new material anyway.`;
  }

  function begin() {
    segmentStart = Date.now();
    if (!firstStartedAt) firstStartedAt = segmentStart;
    persist(segmentStart);
    ctx.store.save(ctx.state);
    root.innerHTML = `<div class="session-bar">
        <a class="btn secondary icon" href="#/home" aria-label="Exit session (progress is saved)" title="Exit">×</a>
        <div class="progress" role="progressbar" aria-label="Session progress"><div class="progress-fill"></div></div>
        <div data-flag></div>
      </div>
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
    const timeUp = mode === "quick" && elapsedMs + Date.now() - segmentStart >= QUICK_MS;
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
          requeueWrong(queue, pos, item, Math.random, ctx.content);
        }
        pos++;
        persist(now);
        ctx.store.save(ctx.state);
        next();
      },
    });
  }

  function finish() {
    finished = true;
    const minutes = (Date.now() - segmentStart) / 60000;
    ctx.state = { ...addMinutes(ctx.state, minutes, Date.now()), activeSession: null };
    ctx.store.save(ctx.state);
    ctx.store.flush();
    const summary = summarize({
      before: patternsBefore, state: ctx.state, content: ctx.content, stats, startedAt: firstStartedAt, now: Date.now(),
    });
    renderSummary(root, { summary, content: ctx.content, onMore: () => ctx.navigate("#/session?mode=quick") });
    alive = false;
  }

  start();
  return () => {
    // Leaving mid-session (× or the back button): count the time and keep the place.
    if (alive && segmentStart && !finished) {
      const now = Date.now();
      persist(now);
      ctx.state = addMinutes(ctx.state, (now - segmentStart) / 60000, now);
      ctx.store.save(ctx.state);
      if (pos > 0) toast("Progress saved. Continue from Home.");
    }
    alive = false;
    if (typeof cardCleanup === "function") cardCleanup();
    ctx.store.flush();
  };
}
