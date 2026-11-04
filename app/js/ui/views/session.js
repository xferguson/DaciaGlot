// Study loop: Quick / Mix / Learn / Review / Focus (PRD FR-S2…S9). Renders T07 cards one after another.
import { buildSession, gradeFromResult, applyReview, applyErReview, erMisses, applyParadigm, applyCheck, checkBlanks, addMinutes, requeueWrong, keepStarted, markDifficult, claimForm, unclaimForm, shownUnits, isPrimed, deferPrimed } from "../../core/session.js";
import { parseCardId, unitIdOfFm, exampleSentenceFor } from "../../core/cards.js";
import { unitsRequiredForCard } from "../../core/units.js";
import { resolveFm } from "../../core/carrier.js";
import { renderCard as renderLr } from "../components/cards/card-lr.js";
import { renderCard as renderCz } from "../components/cards/card-cloze.js";
import { renderCard as renderKf } from "../components/cards/card-keyform.js";
import { renderCard as renderXf } from "../components/cards/card-transform.js";
import { renderCard as renderSb } from "../components/cards/card-slot.js";
import { speechFor } from "../components/speech.js";
import { sun } from "../components/ornament.js";
import { renderCard as renderEr } from "../components/cards/card-enro.js";
import { renderCard as renderPg } from "../components/cards/card-paradigm.js";
import { toast } from "../components/toast.js";
import { flagButton } from "../components/flag-button.js";
import { situationName, parseFocusParam } from "../models/lists.js";
import { allPatternStates } from "../../core/mastery.js";
import { summarize } from "../models/summary.js";
import { renderSummary } from "../components/session-summary.js";
import { sessionPace, checkAccuracy, recordSession } from "../../core/pace.js";
import { button } from "../components/button.js";

const QUICK_MS = 5 * 60 * 1000;
const MODES = ["quick", "mix", "learn", "review"];
const TITLES = { quick: "Quick", mix: "Mix", learn: "Learn", review: "Review", session: "Session" };
const EMPTY = {
  learn: "No new sentences are ready right now. Review what's due and they'll unlock.",
  review: "Nothing is due. Nice work.",
};
const RENDERERS = { lr: renderLr, cz: renderCz, kf: renderKf, xf: renderXf, sb: renderSb, er: renderEr };

export function render(root, ctx) {
  /** Ready-made `speak` and `rate` for cards, bound to the current settings (read at call time). */
  const speechProps = () => speechFor({ tts: ctx.tts, settings: ctx.state.settings });
  const claims = {
    content: ctx.content,
    isClaimed: (unit) => unit in ctx.state.claimed,
    claim: (unit) => { ctx.update((s) => claimForm(s, unit, Date.now())); },
    unclaim: (unit) => { ctx.update((s) => unclaimForm(s, unit, Date.now())); },
  };
  const params = ctx.route?.params ?? {};
  // Old links (`mode=session`, `mode=focus`) open Mix. A focus (`f=type:id,…`, or old `type`+`id`) filters any mode (FR-S8).
  const mode = MODES.includes(params.mode) ? params.mode : "mix";
  const focus = parseFocusParam(params);
  let { queue, blocked, suggest, plan } = buildSession({
    mode, focus, state: ctx.state, content: ctx.content, now: Date.now(), rng: Math.random,
  });
  let cardCleanup = null;
  let alive = true;
  let pos = 0;
  let startedAt = 0;
  let finished = false;
  const exposuresBefore = new Set(Object.keys(ctx.state.seenSentences));
  const stats = { cards: 0, correct: 0, newSentences: 0, difficult: 0 };
  const carriersUsed = new Set(); // sentences an `fm` card was already shown in this session
  const onScreen = new Set(); // word-form units already on screen this session (T40, FR-S14)
  const struggled = new Set(); // cards answered wrong once already this session (FR-S9)
  const patternsBefore = allPatternStates(ctx.state, ctx.content, Date.now());

  const home = `<a class="btn secondary block" href="#/home">Home</a>`;

  const topicName = (f) => (f.type === "pattern" ? ctx.content.patterns.get(f.id)?.name : situationName(f.id)) ?? f.id;
  const focusName = () => focus.map(topicName).join(" + ");

  function blockedNote() {
    if (!blocked) return "";
    return `<section class="card"><p>No new sentences are ready for <strong data-focus></strong> yet.</p>
      ${suggest ? `<button class="btn block" type="button" data-switch>Focus on <span data-suggest></span> first</button>` : ""}</section>`;
  }

  function fillNames() {
    const f = root.querySelector("[data-focus]");
    if (f) f.textContent = focusName();
    const s = root.querySelector("[data-suggest]");
    if (s) s.textContent = topicName(suggest);
  }

  function start() {
    if (blocked) {
      root.innerHTML = `<h1>${TITLES[mode]}</h1>${blockedNote()}${queue.length ? `<button class="btn secondary block" data-due>Review ${queue.length} due cards</button>` : ""}${home}`;
      fillNames();
      root.querySelector("[data-due]")?.addEventListener("click", begin);
      root.querySelector("[data-switch]")?.addEventListener("click", () => {
        ctx.updateSettings({ focus: [suggest] });
        ctx.navigate(`#/session?mode=${mode}&f=${encodeURIComponent(`${suggest.type}:${suggest.id}`)}`);
      });
      return;
    }
    if (!queue.length) {
      root.innerHTML = `<h1>${TITLES[mode]}</h1>
        ${sun()}<p class="muted">${focus.length ? "Nothing in this focus right now. Clear the focus on Home or pick another topic." : EMPTY[mode] ?? "Nothing to study right now."}</p>${home}`;
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
    startedAt = Date.now();
    root.innerHTML = `<div class="session-bar">
        <span data-end></span>
        <div class="progress" role="progressbar" aria-label="Session progress"><div class="progress-fill"></div></div>
        <span class="progress-count" aria-hidden="true"></span>
        <div data-flag></div>
      </div>
      <div data-card></div>`;
    const end = button("×", "btn secondary icon", () => ctx.navigate("#/home"), { title: "End session" });
    end.setAttribute("aria-label", "End session (answers so far are saved)");
    root.querySelector("[data-end]").replaceWith(end);
    next();
  }

  function progress() {
    const fill = root.querySelector(".progress-fill");
    if (fill) fill.style.width = `${Math.round((pos / Math.max(queue.length, 1)) * 100)}%`;
    const count = root.querySelector(".progress-count");
    if (count) count.textContent = `${pos}/${queue.length}`;
    root.querySelector(".progress")?.setAttribute("aria-valuetext", `${pos} of ${queue.length} done`);
  }

  function next() {
    if (!alive) return;
    if (typeof cardCleanup === "function") cardCleanup();
    cardCleanup = null;
    const timeUp = mode === "quick" && Date.now() - startedAt >= QUICK_MS;
    if (pos >= queue.length || timeUp) return finish();
    // T40: a card testing a word that was just on screen is swapped for a later one, or left for another day.
    queue = deferPrimed(queue, pos, onScreen, ctx.content).queue;
    if (pos >= queue.length) return finish();
    progress();
    const item = queue[pos];
    const primed = isPrimed(item, onScreen, ctx.content);
    if (item.members) {
      for (const u of shownUnits(item, null, ctx.content)) onScreen.add(u);
      return showParadigm(item);
    }
    if (item.check) return showCheck({ ...item, forms: item.forms ?? [item.cardId] });
    // An `fm` card is the schedule of one word form; it is shown as a cloze in a fresh sentence, or as a key-form drill.
    let shown = item.cardId;
    if (parseCardId(item.cardId).type === "fm") {
      if (unitIdOfFm(item.cardId) in ctx.state.claimed) { pos++; return next(); } // claimed mid-session (FR-R4)
      const r = resolveFm(item.cardId, ctx.state, ctx.content, {
        now: Date.now(), rng: Math.random, exclude: carriersUsed, prefer: item.isNew ? item.from : undefined,
      });
      if (!r) { pos++; return next(); }
      shown = r.presentedId;
      if (r.sentenceId) carriersUsed.add(r.sentenceId);
    }
    const p = parseCardId(shown);
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
          ctx.update((s) => ({ ...s, flags: [...s.flags, flag] }));
          toast("Flagged. See Settings to report it.");
        },
      }));
    }
    if (p.type !== "lr") for (const u of shownUnits(item, sentence, ctx.content)) onScreen.add(u);
    cardCleanup = draw(slot, {
      card: shown,
      onOptions: (opts) => { for (const u of shownUnits(item, null, ctx.content, opts)) onScreen.add(u); },
      sentence,
      label: item.composite ? `Review · ${item.units.length} forms` : undefined,
      content: ctx.content,
      ...speechProps(),
      settings: ctx.state.settings,
      claims,
      onSetting(patch) {
        ctx.updateSettings(patch);
      },
      onResult(r) {
        const grade = gradeFromResult(r);
        const now = Date.now();
        const seenBefore = Object.keys(ctx.state.seenSentences).length;
        const isEr = p.type === "er";
        const units = unitsRequiredForCard(shown, ctx.content);
        // FR-S9: wrong → back once, 3–5 cards later; wrong a second time → off to the difficult list. Hard is not re-queued.
        // A missed `er` waits for the ladder; its wrong parts return as single-form reviews (FR-D6).
        const requeue = grade === 1 && !isEr && !struggled.has(item.cardId);
        const markHard = grade === 1 && !isEr && struggled.has(item.cardId) && !(item.cardId in ctx.state.difficult);
        ctx.update((s) => {
          const reviewed = isEr
            ? applyErReview(s, item.cardId, grade, units, erMisses(sentence, r.diff), now, ctx.content, shown, item.composite ? item.units : null, { primed })
            : applyReview(s, item.cardId, grade, units, now, ctx.content, shown, { primed });
          return markHard ? markDifficult(reviewed, item.cardId, now) : reviewed;
        });
        stats.cards++;
        if (grade > 1) stats.correct++;
        if (Object.keys(ctx.state.seenSentences).length > seenBefore) stats.newSentences++;
        if (markHard) stats.difficult++;
        if (requeue) {
          struggled.add(item.cardId);
          queue = requeueWrong(queue, pos, item, Math.random, ctx.content).queue;
        }
        pos++;
        next();
      },
    });
  }

  /** FR-R5: a family of sentences shown once; they all count as seen and the unchecked forms come back tomorrow. */
  function showParadigm(item) {
    const slot = root.querySelector("[data-card]");
    slot.replaceChildren();
    root.querySelector("[data-flag]").replaceChildren();
    cardCleanup = renderPg(slot, {
      members: item.members,
      content: ctx.content,
      ...speechProps(),
      settings: ctx.state.settings,
      onResult() {
        const before = Object.keys(ctx.state.seenSentences).length;
        ctx.update((s) => applyParadigm(s, item, Date.now(), ctx.content));
        stats.cards++;
        stats.correct++;
        stats.newSentences += Object.keys(ctx.state.seenSentences).length - before;
        pos++;
        next();
      },
    });
  }

  /**
   * FR-R2: a new sentence's one immediate check blanks all its new forms in that sentence. It is uncounted: each form
   * gets its `fm` card due tomorrow whatever the answer, and wrong forms are asked once more at the end.
   */
  function showCheck(item) {
    const forms = item.forms.filter((id) => !(unitIdOfFm(id) in ctx.state.claimed));
    const sentence = ctx.content.sentences.get(item.from);
    const blanks = sentence ? checkBlanks(sentence, forms) : [];
    if (!blanks.length) {
      ctx.update((s) => keepStarted(s, [{ ...item, forms }], Date.now()));
      pos++;
      return next();
    }
    const slot = root.querySelector("[data-card]");
    slot.replaceChildren();
    root.querySelector("[data-flag]").replaceChildren();
    for (const u of shownUnits(item, sentence, ctx.content)) onScreen.add(u);
    cardCleanup = renderCz(slot, {
      card: blanks[0].presentedId,
      sentence,
      ...speechProps(),
      settings: ctx.state.settings,
      check: true,
      blanks: blanks.map((b) => b.tokenIndex),
      onResult(r) {
        const now = Date.now();
        const okAt = new Map((r.blanks ?? []).map((b) => [b.tokenIndex, b.ok]));
        const oks = blanks.map((b) => okAt.get(b.tokenIndex) ?? r.result !== "wrong");
        const wrong = blanks.filter((_, i) => !oks[i]).map((b) => b.cardId);
        ctx.update((s) => blanks.reduce(
          (acc, b, i) => applyCheck(acc, b.cardId, oks[i], unitsRequiredForCard(b.presentedId, ctx.content), now, b.presentedId, ctx.content),
          s,
        ));
        stats.cards++;
        if (!wrong.length) stats.correct++;
        if (wrong.length && !item.requeued) {
          queue.push({ cardId: wrong[0], isNew: false, from: item.from, check: true, forms: wrong, requeued: true });
        }
        pos++;
        next();
      },
    });
  }

  /** `seenSentences` entries first seen during this session. */
  function newExposures(st = ctx.state) {
    return Object.fromEntries(Object.entries(st.seenSentences).filter(([id]) => !exposuresBefore.has(id)));
  }

  function finish() {
    finished = true;
    const endedAt = Date.now();
    let pace;
    ctx.update((s) => {
      const timed = addMinutes(s, (endedAt - startedAt) / 60000, endedAt);
      pace = sessionPace(timed.attempts, newExposures(timed), startedAt, endedAt, ctx.content);
      return recordSession(timed, { pace, accuracy: checkAccuracy(timed.attempts, startedAt, endedAt), learn: mode === "learn", now: endedAt });
    });
    ctx.store.flush();
    const summary = summarize({
      before: patternsBefore, state: ctx.state, content: ctx.content, stats, startedAt, now: endedAt, pace,
      target: ctx.state.settings.paceTarget,
    });
    renderSummary(root, { summary, content: ctx.content, onMore: () => ctx.navigate("#/session?mode=quick") });
    alive = false;
  }

  start();
  return () => {
    // Leaving mid-session (× or the back button) ends it. Every answer is already saved; count the
    // time and make sure a half-introduced sentence's cloze cards come back next time.
    if (alive && startedAt && !finished) {
      const now = Date.now();
      ctx.update((s) => {
        const timed = addMinutes(keepStarted(s, queue.slice(pos), now), (now - startedAt) / 60000, now);
        return recordSession(timed, { pace: sessionPace(timed.attempts, newExposures(timed), startedAt, now, ctx.content), accuracy: null, learn: false, now });
      });
      if (stats.cards) toast(`Session ended. Your ${stats.cards} answer${stats.cards === 1 ? " is" : "s are"} saved.`);
    }
    alive = false;
    if (typeof cardCleanup === "function") cardCleanup();
    ctx.store.flush();
  };
}
