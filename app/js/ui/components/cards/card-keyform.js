// Key-forms card (PRD FR-D3). Lemma + gloss + form label; the learner types the form.

import { checkAnswer } from "../../../core/check.js";
import { answerStep, initialAnswer, canRate } from "../../../core/answer.js";
import { parseCardId, labelFor } from "../../../core/cards.js";
import { audioButton } from "../audio-button.js";
import { answerInput } from "../answer-input.js";
import { diacriticBar } from "../diacritic-bar.js";
import { renderFeedback, nextButtons, partsFor } from "../feedback.js";
import { button } from "../button.js";
import { retryMessage } from "../answer-card.js";

/**
 * `sentence` is an already-seen sentence containing this form, or null (then the form alone is played).
 */
export function renderCard(root, { card, sentence = null, content, tts, settings = {}, onResult, claims = null }) {
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

  const checkBtn = button("Check", "btn", () => check());
  const hintBtn = button("Hint", "btn secondary", () => {
    st = answerStep(st, { type: "hint" }).state;
    hintLine.textContent = `Hint: ${[...expected][0]}…`;
    input.focus();
  });
  actions.append(hintBtn, checkBtn);

  let st = initialAnswer();

  function finish(result) {
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
      claims,
    });
    root.querySelector(".audio-row").append(audioButton({ text: sentence?.ro ?? expected, rateNormal: rate }));
    const { usedHint, attempts } = st;
    nextButtons(actions, {
      canRate: canRate(st, result),
      onPick: (rating) => onResult({ result, usedHint, attemptNo: attempts, rating }),
    });
  }

  function check() {
    if (st.finished || !input.value.trim()) return;
    const { result } = checkAnswer(input.value, expected);
    const { state, effect } = answerStep(st, { type: "check", result });
    st = state;
    if (effect === "finish") return finish(result);
    slot.replaceChildren(retryMessage());
    input.select();
    input.focus();
  }

  input.focus();
  return () => { st = { ...st, finished: true }; };
}
