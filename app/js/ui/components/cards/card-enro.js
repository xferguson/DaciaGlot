// EN→RO card (PRD FR-D6, FR-D7, FR-D8, FR-V4). Shows the English; answer by speaking and self-grading, by word tiles,
// or by typing the whole Romanian sentence (one retry). Audio is hidden until the answer is revealed.

import { checkAnswer } from "../../../core/check.js";
import { lexemeForms } from "../../../core/cards.js";
import { audioButton } from "../audio-button.js";
import { getMode, mountAnswer, tapDiff, wordsOf } from "../answer-mode.js";
import { erMisses } from "../../../core/session.js";
import { renderFeedback, nextButtons, partsFor } from "../feedback.js";

/** Pure: first letter of each expected token that is still wrong or missing. */
export function hintFor(input, expected, accept = []) {
  const { diff } = checkAnswer(input, expected, accept);
  return diff.filter((d) => d.status === "wrong" || d.status === "missing")
    .map((d) => [...d.token][0] + "…").join(" ");
}

export function renderCard(root, { card, sentence, content, tts, settings = {}, label, onResult, onSetting, rng = Math.random }) {
  const rate = settings.ttsRate ?? 0.9;
  const speak = (text, opts) => tts?.speak?.(text, { rate, ...opts });
  const accept = sentence.accept ?? [];
  const avoid = content ? lexemeForms(sentence, content) : [];

  root.innerHTML = `
    <section class="card card-enro" data-card="${card?.id ?? card ?? ""}">
      <p class="muted"></p>
      <p class="en"><strong></strong></p>
      <div class="mode-slot"></div>
      <div class="audio-row"></div>
      <div class="input-slot"></div>
      <div class="bar-slot"></div>
      <div class="hint-line muted" aria-live="polite"></div>
      <div class="feedback-slot"></div>
      <div class="actions row"></div>
    </section>`;
  root.querySelector(".en strong").textContent = sentence.en ?? "";
  root.querySelector("p.muted").textContent = label ? `${label} · say it in Romanian` : "Say it in Romanian";
  const audioRow = root.querySelector(".audio-row");
  const hintLine = root.querySelector(".hint-line");
  const slot = root.querySelector(".feedback-slot");
  const actions = root.querySelector(".actions");
  const slots = { mode: root.querySelector(".mode-slot"), input: root.querySelector(".input-slot"), bar: root.querySelector(".bar-slot"), actions };

  let mode = getMode(settings);
  let input = null;
  let attempts = 0;
  let usedHint = false;
  let finished = false;

  function mount() {
    ({ input } = mountAnswer({
      mode, slots, sentence, content, rng, label: "Romanian sentence",
      words: wordsOf(sentence), size: Math.max(sentence.ro.length, 12),
      say: () => { showAudio(); speak(sentence.ro); },
      onCheck: check,
      onHint() {
        usedHint = true;
        hintLine.textContent = `Hint: ${hintFor(input.value, sentence.ro, accept)}`;
        input.focus();
      },
      onSpeakDone(tapped) {
        attempts = 1;
        finish(tapped.size ? "wrong" : "correct", tapDiff(wordsOf(sentence), tapped), true);
      },
      onMode(m) {
        if (finished || attempts || m === mode) return;
        mode = m;
        onSetting?.({ answerMode: m });
        mount();
      },
    }));
    input?.focus();
  }

  function showAudio() {
    if (!audioRow.firstChild) audioRow.append(audioButton({ text: sentence.ro, rateNormal: rate }));
  }

  function finish(result, diff = checkAnswer(input.value, sentence.ro, accept, { avoid }).diff, spoke = false) {
    finished = true;
    if (input) {
      input.readOnly = true;
      input.classList.toggle("ok", result !== "wrong");
      input.classList.toggle("bad", result === "wrong");
    }
    slots.mode.replaceChildren();
    actions.replaceChildren();
    if (spoke) slots.input.replaceChildren();
    hintLine.textContent = "";
    showAudio();
    if (!spoke) speak(sentence.ro);
    renderFeedback(slot, {
      result,
      parts: partsFor(sentence.tokens, diff),
      en: sentence.en,
    });
    const misses = erMisses(sentence, diff);
    if (misses?.missedTokens.length) {
      const note = document.createElement("p");
      note.className = "muted";
      note.textContent = `${misses.missedTokens.join(", ")} will be reviewed on its own.`;
      slot.append(note);
    }
    const clean = result !== "wrong" && attempts === 1 && !usedHint;
    nextButtons(actions, {
      canRate: clean,
      onPick: (rating) => onResult({ result, usedHint, attemptNo: attempts, rating, diff }),
    });
  }

  function check() {
    if (finished || !input?.value.trim()) return;
    attempts++;
    const { result } = checkAnswer(input.value, sentence.ro, accept, { avoid });
    if (result !== "wrong") return finish(result);
    if (attempts >= 2) return finish("wrong");
    showAudio();
    slot.replaceChildren();
    const msg = document.createElement("p");
    msg.className = "feedback bad";
    msg.setAttribute("role", "status");
    msg.textContent = "Not quite. Try once more.";
    slot.append(msg);
    input.select();
    input.focus();
  }

  mount();
  return () => { finished = true; };
}
