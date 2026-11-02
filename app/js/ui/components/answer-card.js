// Shared controller for the whole-sentence typed-answer cards (en→ro, transform, slot-building): one try plus one retry,
// hint, three answer modes. A card file supplies its header markup and the expected text; this does the rest.

import { checkAnswer } from "../../core/check.js";
import { hintFor } from "../../core/check.js";
import { answerStep, initialAnswer, canRate } from "../../core/answer.js";
import { audioButton } from "./audio-button.js";
import { getMode, mountAnswer, tapDiff, wordsOf } from "./answer-mode.js";
import { renderFeedback, nextButtons, partsFor } from "./feedback.js";

/** Pure: the "Not quite" retry message element. */
export function retryMessage(text = "Not quite. Try once more.") {
  const msg = document.createElement("p");
  msg.className = "feedback bad";
  msg.setAttribute("role", "status");
  msg.textContent = text;
  return msg;
}

/**
 * Renders `<section class="card {cls}">` into `root`: `header` markup, then the mode, input, bar, hint, feedback and
 * action slots (plus an `.audio-row` in the middle when `audio:"mid"`, after the feedback when `audio:"end"`).
 * `ro` overrides the sentence text for tiles and speak words (transform / slot cards).
 * `extras(diff, feedbackSlot)` runs at the end of the card and may return fields to add to the `onResult` payload.
 * Returns a cleanup function.
 */
export function answerCard(root, {
  cls, dataCard, header = "", audio = null, label, expected, accept = [], avoid = [], ro = undefined,
  sentence, content, speak, settings = {}, rng = Math.random, partTokens = [], en = null,
  onResult, onSetting, extras,
}) {
  const rate = settings.ttsRate ?? 0.9;
  root.innerHTML = `
    <section class="card ${cls}" data-card="${dataCard}">
      ${header}
      <div class="mode-slot"></div>
      ${audio === "mid" ? '<div class="audio-row"></div>' : ""}
      <div class="input-slot"></div>
      <div class="bar-slot"></div>
      <div class="hint-line muted" aria-live="polite"></div>
      <div class="feedback-slot"></div>
      ${audio === "end" ? '<div class="audio-row"></div>' : ""}
      <div class="actions row"></div>
    </section>`;
  const hintLine = root.querySelector(".hint-line");
  const slot = root.querySelector(".feedback-slot");
  const actions = root.querySelector(".actions");
  const slots = { mode: root.querySelector(".mode-slot"), input: root.querySelector(".input-slot"), bar: root.querySelector(".bar-slot"), actions };

  let st = initialAnswer(getMode(settings));
  let input = null;
  const step = (event) => {
    const r = answerStep(st, event);
    st = r.state;
    return r.effect;
  };
  const showAudio = () => {
    const row = root.querySelector(".audio-row");
    if (audio && row && !row.firstChild) row.append(audioButton({ text: expected, rateNormal: rate }));
  };

  function mount() {
    ({ input } = mountAnswer({
      mode: st.mode, slots, sentence, content, rng, ro, label,
      words: wordsOf(sentence, ro), size: Math.max(expected.length, 12),
      say: () => { if (audio === "mid") showAudio(); speak(expected); },
      onCheck: check,
      onHint() {
        step({ type: "hint" });
        hintLine.textContent = `Hint: ${hintFor(input.value, expected, accept)}`;
        input.focus();
      },
      onSpeakDone(tapped) {
        step({ type: "spoke" });
        finish(tapped.size ? "wrong" : "correct", tapDiff(wordsOf(sentence, ro), tapped), true);
      },
      onMode(m) {
        const before = st.mode;
        step({ type: "mode", mode: m });
        if (st.mode === before) return;
        onSetting?.({ answerMode: m });
        mount();
      },
    }));
    input?.focus();
  }

  function finish(result, diff = checkAnswer(input.value, expected, accept, { avoid }).diff, spoke = false) {
    if (input) {
      input.readOnly = true;
      input.classList.toggle("ok", result !== "wrong");
      input.classList.toggle("bad", result === "wrong");
    }
    slots.mode.replaceChildren();
    actions.replaceChildren();
    if (spoke) slots.input.replaceChildren();
    hintLine.textContent = "";
    if (audio === "mid") showAudio();
    if (!spoke) speak(expected);
    renderFeedback(slot, { result, parts: partsFor(partTokens, diff), en });
    if (audio === "end") showAudio();
    const extra = extras?.(diff, slot) ?? {};
    const { usedHint, attempts } = st;
    nextButtons(actions, {
      canRate: canRate(st, result),
      onPick: (rating) => onResult({ result, usedHint, attemptNo: attempts, rating, ...extra }),
    });
  }

  function check() {
    if (st.finished || !input?.value.trim()) return;
    const { result } = checkAnswer(input.value, expected, accept, { avoid });
    const effect = step({ type: "check", result });
    if (effect === "finish") return finish(result);
    if (audio === "mid") showAudio();
    slot.replaceChildren(retryMessage());
    input.select();
    input.focus();
  }

  mount();
  return () => { st = { ...st, finished: true }; };
}
