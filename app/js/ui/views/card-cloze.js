// Cloze card (PRD FR-D2, FR-D7, FR-D8). Type the blanked token; one retry.

import { checkAnswer } from "../../core/check.js";
import { audioButton } from "../components/audio-button.js";
import { answerInput } from "../components/answer-input.js";
import { diacriticBar } from "../components/diacritic-bar.js";
import { renderFeedback, partsFor } from "../components/feedback.js";

/** Pure: first letter of each expected token that is still wrong or missing. */
export function hintFor(input, expected, accept = []) {
  const { diff } = checkAnswer(input, expected, accept);
  return diff.filter((d) => d.status === "wrong" || d.status === "missing")
    .map((d) => [...d.token][0] + "…").join(" ");
}

/** Token index from a card or id string `cz:<sentenceId>:<idx>`. */
export function tokenIndexOf(card) {
  const id = typeof card === "string" ? card : card.id ?? card.cardId;
  return Number(id.split(":").pop());
}

export function renderCard(root, { card, sentence, tts, settings = {}, onResult }) {
  const rate = settings.ttsRate ?? 0.9;
  const speak = (text, opts) => tts?.speak?.(text, { rate, ...opts });
  const idx = tokenIndexOf(card);
  const target = sentence.tokens[idx];
  const expected = target.t;
  const input = answerInput({ size: expected.length + 1, onSubmit: () => check() });
  input.setAttribute("aria-label", "Missing word");

  root.innerHTML = `
    <section class="card card-cloze" data-card="${card?.id ?? card ?? ""}">
      <p class="muted">Fill in the blank</p>
      <p class="en"></p>
      <p class="cloze-line" lang="ro"></p>
      <div class="audio-row"></div>
      <div class="bar-slot"></div>
      <div class="hint-line muted" aria-live="polite"></div>
      <div class="feedback-slot"></div>
      <div class="actions row"></div>
    </section>`;
  root.querySelector(".en").textContent = sentence.en ?? "";
  const line = root.querySelector(".cloze-line");
  sentence.tokens.forEach((t, i) => {
    if (i) line.append(" ");
    if (i === idx) line.append(input);
    else line.append(t.t);
  });
  root.querySelector(".audio-row").append(audioButton({ text: sentence.ro, rateNormal: rate }));
  root.querySelector(".bar-slot").append(diacriticBar(() => input));
  const hintLine = root.querySelector(".hint-line");
  const slot = root.querySelector(".feedback-slot");
  const actions = root.querySelector(".actions");

  const checkBtn = Object.assign(document.createElement("button"), { type: "button", className: "btn", textContent: "Check" });
  const hintBtn = Object.assign(document.createElement("button"), { type: "button", className: "btn secondary", textContent: "Hint" });
  actions.append(hintBtn, checkBtn);
  checkBtn.addEventListener("click", () => check());
  hintBtn.addEventListener("click", () => {
    usedHint = true;
    hintLine.textContent = `Hint: ${hintFor(input.value, expected, [])}`;
    input.focus();
  });

  let attempts = 0;
  let usedHint = false;
  let tooEasy = false;
  let finished = false;

  function finish(result) {
    finished = true;
    input.readOnly = true;
    input.classList.toggle("ok", result !== "wrong");
    input.classList.toggle("bad", result === "wrong");
    actions.replaceChildren();
    hintLine.textContent = "";
    speak(sentence.ro);
    const diff = checkAnswer(input.value, expected).diff;
    renderFeedback(slot, {
      result,
      parts: partsFor(sentence.tokens, diff, idx),
      en: sentence.en,
      onTooEasy: result !== "wrong" && attempts === 1 && !usedHint ? (on) => { tooEasy = on; } : null,
    });
    const next = Object.assign(document.createElement("button"), { type: "button", className: "btn block", textContent: "Continue" });
    next.addEventListener("click", () => onResult({ result, usedHint, attemptNo: attempts, tooEasy }), { once: true });
    actions.append(next);
    next.focus();
  }

  function check() {
    if (finished || !input.value.trim()) return;
    attempts++;
    const { result } = checkAnswer(input.value, expected);
    if (result !== "wrong") return finish(result);
    if (attempts >= 2) return finish("wrong");
    slot.replaceChildren();
    const msg = document.createElement("p");
    msg.className = "feedback bad";
    msg.setAttribute("role", "status");
    msg.textContent = "Not quite. Try once more.";
    slot.append(msg);
    input.select();
    input.focus();
  }

  if (settings.autoplay !== false) speak(sentence.ro);
  input.focus();
  return () => { finished = true; };
}
