// EN→RO card (PRD FR-D6, FR-D7, FR-D8). Shows the English; type the whole Romanian sentence; one retry.
// Audio is hidden until the first wrong attempt, then offered as a reveal.

import { checkAnswer } from "../../core/check.js";
import { audioButton } from "../components/audio-button.js";
import { answerInput } from "../components/answer-input.js";
import { diacriticBar } from "../components/diacritic-bar.js";
import { renderFeedback, nextButtons, partsFor } from "../components/feedback.js";

/** Pure: first letter of each expected token that is still wrong or missing. */
export function hintFor(input, expected, accept = []) {
  const { diff } = checkAnswer(input, expected, accept);
  return diff.filter((d) => d.status === "wrong" || d.status === "missing")
    .map((d) => [...d.token][0] + "…").join(" ");
}

export function renderCard(root, { card, sentence, tts, settings = {}, onResult }) {
  const rate = settings.ttsRate ?? 0.9;
  const speak = (text, opts) => tts?.speak?.(text, { rate, ...opts });
  const accept = sentence.accept ?? [];
  const input = answerInput({ size: Math.max(sentence.ro.length, 12), onSubmit: () => check() });
  input.setAttribute("aria-label", "Romanian sentence");

  root.innerHTML = `
    <section class="card card-enro" data-card="${card?.id ?? card ?? ""}">
      <p class="muted">Say it in Romanian</p>
      <p class="en"><strong></strong></p>
      <div class="audio-row"></div>
      <div class="input-slot"></div>
      <div class="bar-slot"></div>
      <div class="hint-line muted" aria-live="polite"></div>
      <div class="feedback-slot"></div>
      <div class="actions row"></div>
    </section>`;
  root.querySelector(".en strong").textContent = sentence.en ?? "";
  root.querySelector(".input-slot").append(input);
  root.querySelector(".bar-slot").append(diacriticBar(() => input));
  const audioRow = root.querySelector(".audio-row");
  const hintLine = root.querySelector(".hint-line");
  const slot = root.querySelector(".feedback-slot");
  const actions = root.querySelector(".actions");

  const checkBtn = Object.assign(document.createElement("button"), { type: "button", className: "btn", textContent: "Check" });
  const hintBtn = Object.assign(document.createElement("button"), { type: "button", className: "btn secondary", textContent: "Hint" });
  actions.append(hintBtn, checkBtn);
  checkBtn.addEventListener("click", () => check());
  hintBtn.addEventListener("click", () => {
    usedHint = true;
    hintLine.textContent = `Hint: ${hintFor(input.value, sentence.ro, accept)}`;
    input.focus();
  });

  let attempts = 0;
  let usedHint = false;
  let finished = false;

  function finish(result) {
    finished = true;
    input.readOnly = true;
    input.classList.toggle("ok", result !== "wrong");
    input.classList.toggle("bad", result === "wrong");
    actions.replaceChildren();
    hintLine.textContent = "";
    if (!audioRow.firstChild) audioRow.append(audioButton({ text: sentence.ro, rateNormal: rate }));
    speak(sentence.ro);
    const diff = checkAnswer(input.value, sentence.ro, accept).diff;
    renderFeedback(slot, {
      result,
      parts: partsFor(sentence.tokens, diff),
      en: sentence.en,
    });
    nextButtons(actions, {
      canRate: result !== "wrong" && attempts === 1 && !usedHint,
      onPick: (rating) => onResult({ result, usedHint, attemptNo: attempts, rating }),
    });
  }

  function check() {
    if (finished || !input.value.trim()) return;
    attempts++;
    const { result } = checkAnswer(input.value, sentence.ro, accept);
    if (result !== "wrong") return finish(result);
    if (attempts >= 2) return finish("wrong");
    if (!audioRow.firstChild) audioRow.append(audioButton({ text: sentence.ro, rateNormal: rate }));
    slot.replaceChildren();
    const msg = document.createElement("p");
    msg.className = "feedback bad";
    msg.setAttribute("role", "status");
    msg.textContent = "Not quite. Try once more.";
    slot.append(msg);
    input.select();
    input.focus();
  }

  input.focus();
  return () => { finished = true; };
}
