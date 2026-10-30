// Key-forms card (PRD FR-D3). Lemma + gloss + form label; the learner types the form.

import { checkAnswer } from "../../core/check.js";
import { parseCardId, labelFor } from "../../core/cards.js";
import { audioButton } from "../components/audio-button.js";
import { answerInput } from "../components/answer-input.js";
import { diacriticBar } from "../components/diacritic-bar.js";
import { renderFeedback, nextButtons, partsFor } from "../components/feedback.js";

/**
 * `sentence` is an already-seen sentence containing this form, or null (then the form alone is played).
 */
export function renderCard(root, { card, sentence = null, content, tts, settings = {}, onResult }) {
  const { lexemeId, formKey } = parseCardId(typeof card === "string" ? card : card.id ?? card.cardId);
  const lexeme = content.lexemes.get(lexemeId);
  const expected = lexeme.forms[formKey];
  const rate = settings.ttsRate ?? 0.9;
  const speak = (text, opts) => tts?.speak?.(text, { rate, ...opts });
  const input = answerInput({ size: expected.length + 1, onSubmit: () => check() });
  input.setAttribute("aria-label", labelFor(formKey));

  root.innerHTML = `
    <section class="card card-keyform" data-card="${lexemeId}:${formKey}">
      <p class="muted">Key form</p>
      <p class="kf-lemma" lang="ro"><strong></strong></p>
      <p class="muted kf-gloss"></p>
      <p class="kf-label"></p>
      <div class="input-slot"></div>
      <div class="bar-slot"></div>
      <div class="hint-line muted" aria-live="polite"></div>
      <div class="feedback-slot"></div>
      <div class="audio-row"></div>
      <div class="actions row"></div>
    </section>`;
  root.querySelector(".kf-lemma strong").textContent = lexeme.lemma;
  root.querySelector(".kf-gloss").textContent = lexeme.gloss ?? "";
  root.querySelector(".kf-label").textContent = labelFor(formKey);
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
    hintLine.textContent = `Hint: ${[...expected][0]}…`;
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
    // After a correct answer play a seen example sentence with this form, else the form alone.
    if (result !== "wrong") speak(sentence?.ro ?? expected);
    else speak(expected);
    const diff = checkAnswer(input.value, expected).diff;
    renderFeedback(slot, {
      result,
      parts: partsFor([], diff),
      en: result !== "wrong" && sentence ? `${sentence.ro} — ${sentence.en ?? ""}` : null,
    });
    root.querySelector(".audio-row").append(audioButton({ text: sentence?.ro ?? expected, rateNormal: rate }));
    nextButtons(actions, {
      canRate: result !== "wrong" && attempts === 1 && !usedHint,
      onPick: (rating) => onResult({ result, usedHint, attemptNo: attempts, rating }),
    });
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

  input.focus();
  return () => { finished = true; };
}
