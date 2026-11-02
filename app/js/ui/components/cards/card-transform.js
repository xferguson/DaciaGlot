// Transformation card (PRD FR-D4, FR-D7, FR-D8). Type the whole changed sentence; one retry.

import { checkAnswer } from "../../../core/check.js";
import { parseCardId, opInstruction, lexemeForms } from "../../../core/cards.js";
import { audioButton } from "../audio-button.js";
import { getMode, mountAnswer, tapDiff, wordsOf } from "../answer-mode.js";
import { hintFor } from "../../models/hint.js";
import { renderFeedback, nextButtons, partsFor } from "../feedback.js";

export { hintFor };

export function renderCard(root, { card, sentence, content, tts, settings = {}, onResult, onSetting, rng = Math.random }) {
  const { transformIndex } = parseCardId(typeof card === "string" ? card : card.id ?? card.cardId);
  const t = sentence.transforms[transformIndex];
  const rate = settings.ttsRate ?? 0.9;
  const speak = (text, opts) => tts?.speak?.(text, { rate, ...opts });
  const avoid = content ? lexemeForms(sentence, content) : [];

  root.innerHTML = `
    <section class="card card-transform" data-card="${sentence.id}:${transformIndex}">
      <p class="muted">Transform</p>
      <p class="xf-source" lang="ro"></p>
      <div class="audio-row"></div>
      <p class="xf-instruction"><strong></strong></p>
      <p class="muted xf-en"></p>
      <div class="mode-slot"></div>
      <div class="input-slot"></div>
      <div class="bar-slot"></div>
      <div class="hint-line muted" aria-live="polite"></div>
      <div class="feedback-slot"></div>
      <div class="actions row"></div>
    </section>`;
  root.querySelector(".xf-source").textContent = sentence.ro;
  root.querySelector(".xf-instruction strong").textContent = opInstruction(t.op);
  root.querySelector(".audio-row").append(audioButton({ text: sentence.ro, rateNormal: rate }));
  const hintLine = root.querySelector(".hint-line");
  const slot = root.querySelector(".feedback-slot");
  const actions = root.querySelector(".actions");

  const slots = { mode: root.querySelector(".mode-slot"), input: root.querySelector(".input-slot"), bar: root.querySelector(".bar-slot"), actions };

  let attempts = 0;
  let usedHint = false;
  let finished = false;
  let mode = getMode(settings);
  let input = null;

  function mount() {
    ({ input } = mountAnswer({
      mode, slots, sentence, content, rng, ro: t.ro, label: "Changed sentence",
      words: wordsOf(sentence, t.ro), size: Math.max(t.ro.length, 12),
      say: () => speak(t.ro),
      onCheck: check,
      onHint() {
        usedHint = true;
        hintLine.textContent = `Hint: ${hintFor(input.value, t.ro, t.accept)}`;
        input.focus();
      },
      onSpeakDone(tapped) {
        attempts = 1;
        finish(tapped.size ? "wrong" : "correct", tapDiff(wordsOf(sentence, t.ro), tapped), true);
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

  function finish(result, diff = checkAnswer(input.value, t.ro, t.accept, { avoid }).diff, spoke = false) {
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
    if (!spoke) speak(t.ro);
    renderFeedback(slot, {
      result,
      parts: partsFor([], diff),
      en: t.en ?? null,
    });
    const clean = result !== "wrong" && attempts === 1 && !usedHint;
    nextButtons(actions, {
      canRate: clean,
      onPick: (rating) => onResult({ result, usedHint, attemptNo: attempts, rating }),
    });
  }

  function check() {
    if (finished || !input?.value.trim()) return;
    attempts++;
    const { result } = checkAnswer(input.value, t.ro, t.accept, { avoid });
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
  mount();
  return () => { finished = true; };
}
