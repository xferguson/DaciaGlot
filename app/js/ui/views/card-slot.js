// Slot-building card (PRD FR-D5, FR-D7, FR-D8). Slots derived from a transform; type the whole sentence; one retry.

import { checkAnswer } from "../../core/check.js";
import { parseCardId, slotsFor, lexemeForms } from "../../core/cards.js";
import { audioButton } from "../components/audio-button.js";
import { getMode, mountAnswer, tapDiff, wordsOf } from "../components/answer-mode.js";
import { renderFeedback, nextButtons, partsFor } from "../components/feedback.js";
import { hintFor } from "./card-transform.js";

/** Pure: the tags shown for a slot: Leipzig glosses of the wanted form(s), else the pattern labels. */
export const slotTags = (slot) => (slot.gloss?.length ? slot.gloss : slot.labels);

/** Pure: the slot line as text, e.g. `Ieri + [not] [past] + termina + sprint`. */
export function slotLine(slots) {
  return slots.map((s) => (s.type === "word" ? s.text : slotTags(s).map((l) => `[${l}]`).join(" "))).join(" + ");
}

export function renderCard(root, { card, sentence, content, tts, settings = {}, onResult, onSetting, rng = Math.random }) {
  const { transformIndex } = parseCardId(typeof card === "string" ? card : card.id ?? card.cardId);
  const t = sentence.transforms[transformIndex];
  const rate = settings.ttsRate ?? 0.9;
  const speak = (text, opts) => tts?.speak?.(text, { rate, ...opts });
  const avoid = content ? lexemeForms(sentence, content) : [];

  root.innerHTML = `
    <section class="card card-slot" data-card="${sentence.id}:${transformIndex}">
      <p class="muted">Build the sentence</p>
      <p class="en"></p>
      <p class="slot-line" lang="ro"></p>
      <div class="mode-slot"></div>
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
      chip.className = "chip slot-gloss";
      chip.textContent = slotTags(s).map((l) => `[${l}]`).join(" ");
      if (s.gloss?.length) {
        chip.title = s.labels.join(" · ");
        chip.setAttribute("aria-label", `${s.gloss.join(" ")} (${s.labels.join(", ")})`);
      }
      line.append(chip);
    }
  });
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
      mode, slots, sentence, content, rng, ro: t.ro, label: "Sentence",
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
    const heard = spoke ? Promise.resolve() : speak(t.ro);
    renderFeedback(slot, {
      result,
      parts: partsFor([], diff),
      en: t.en ?? null,
    });
    root.querySelector(".audio-row").append(audioButton({ text: t.ro, rateNormal: rate }));
    const clean = result !== "wrong" && attempts === 1 && !usedHint;
    nextButtons(actions, {
      canRate: clean,
      autoAdvance: clean && settings.autoAdvance !== false ? { after: heard, cancelOn: slot } : null,
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

  mount();
  return () => { finished = true; };
}
