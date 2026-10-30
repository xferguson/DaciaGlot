// Slot-building card (PRD FR-D5, FR-D7, FR-D8). Slots derived from a transform; type the whole sentence; one retry.

import { checkAnswer } from "../../core/check.js";
import { parseCardId, slotsFor } from "../../core/cards.js";
import { audioButton } from "../components/audio-button.js";
import { answerInput } from "../components/answer-input.js";
import { diacriticBar } from "../components/diacritic-bar.js";
import { renderFeedback, nextButtons, partsFor } from "../components/feedback.js";
import { hintFor } from "./card-transform.js";

/** Pure: the slot line as text, e.g. `Ieri + [not] [past] + termina + sprint`. */
export function slotLine(slots) {
  return slots.map((s) => (s.type === "word" ? s.text : s.labels.map((l) => `[${l}]`).join(" "))).join(" + ");
}

export function renderCard(root, { card, sentence, content, tts, settings = {}, onResult }) {
  const { transformIndex } = parseCardId(typeof card === "string" ? card : card.id ?? card.cardId);
  const t = sentence.transforms[transformIndex];
  const rate = settings.ttsRate ?? 0.9;
  const speak = (text, opts) => tts?.speak?.(text, { rate, ...opts });
  const input = answerInput({ size: Math.max(t.ro.length, 12), onSubmit: () => check() });
  input.setAttribute("aria-label", "Sentence");

  root.innerHTML = `
    <section class="card card-slot" data-card="${sentence.id}:${transformIndex}">
      <p class="muted">Build the sentence</p>
      <p class="en"></p>
      <p class="slot-line" lang="ro"></p>
      <div class="input-slot"></div>
      <div class="bar-slot"></div>
      <div class="hint-line muted" aria-live="polite"></div>
      <div class="feedback-slot"></div>
      <div class="audio-row"></div>
      <div class="actions row"></div>
    </section>`;
  root.querySelector(".en").textContent = t.en ?? "";
  const line = root.querySelector(".slot-line");
  slotsFor(sentence, t, content).forEach((s, i) => {
    if (i) line.append(" + ");
    if (s.type === "word") line.append(s.text);
    else {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = s.labels.map((l) => `[${l}]`).join(" ");
      line.append(chip);
    }
  });
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
    root.querySelector(".audio-row").append(audioButton({ text: t.ro, rateNormal: rate }));
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

  input.focus();
  return () => { finished = true; };
}
