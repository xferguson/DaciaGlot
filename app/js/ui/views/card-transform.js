// Transformation card (PRD FR-D4, FR-D7, FR-D8). Type the whole changed sentence; one retry.

import { checkAnswer } from "../../core/check.js";
import { parseCardId, opInstruction } from "../../core/cards.js";
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
  const { transformIndex } = parseCardId(typeof card === "string" ? card : card.id ?? card.cardId);
  const t = sentence.transforms[transformIndex];
  const rate = settings.ttsRate ?? 0.9;
  const speak = (text, opts) => tts?.speak?.(text, { rate, ...opts });
  const input = answerInput({ size: Math.max(t.ro.length, 12), onSubmit: () => check() });
  input.setAttribute("aria-label", "Changed sentence");

  root.innerHTML = `
    <section class="card card-transform" data-card="${sentence.id}:${transformIndex}">
      <p class="muted">Transform</p>
      <p class="xf-source" lang="ro"></p>
      <div class="audio-row"></div>
      <p class="xf-instruction"><strong></strong></p>
      <p class="muted xf-en"></p>
      <div class="input-slot"></div>
      <div class="bar-slot"></div>
      <div class="hint-line muted" aria-live="polite"></div>
      <div class="feedback-slot"></div>
      <div class="actions row"></div>
    </section>`;
  root.querySelector(".xf-source").textContent = sentence.ro;
  root.querySelector(".xf-instruction strong").textContent = opInstruction(t.op);
  root.querySelector(".audio-row").append(audioButton({ text: sentence.ro, rateNormal: rate }));
  root.querySelector(".input-slot").append(input);
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
    hintLine.textContent = `Hint: ${hintFor(input.value, t.ro, t.accept)}`;
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
    speak(t.ro);
    const diff = checkAnswer(input.value, t.ro, t.accept).diff;
    renderFeedback(slot, {
      result,
      parts: partsFor([], diff),
      en: t.en ?? null,
    });
    nextButtons(actions, {
      canRate: result !== "wrong" && attempts === 1 && !usedHint,
      onPick: (rating) => onResult({ result, usedHint, attemptNo: attempts, rating }),
    });
  }

  function check() {
    if (finished || !input.value.trim()) return;
    attempts++;
    const { result } = checkAnswer(input.value, t.ro, t.accept);
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
