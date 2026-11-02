// Listen & recognize card (PRD FR-D1, FR-D7). Pick the text that matches the audio.

import { speechFor } from "../speech.js";
import { audioButton } from "../audio-button.js";
import { renderFeedback, nextButtons, partsFor } from "../feedback.js";

import { shuffle } from "../../../core/random.js";
import { pickDistractors } from "../../models/card-lr.js";

// Q06: `shuffle` lives in core/random.js; re-exported here for one release.
export { shuffle, pickDistractors };


export function renderCard(root, { card, sentence, content, speak: speakIn, rate: rateIn, tts, settings = {}, onResult, rng = Math.random }) {
  const { speak, rate } = speechFor({ speak: speakIn, rate: rateIn, tts, settings });
  const options = shuffle([sentence, ...pickDistractors(sentence, content, rng)], rng);
  root.innerHTML = `
    <section class="card card-lr" data-card="${card?.id ?? card ?? ""}">
      <p class="muted">What did you hear?</p>
      <div class="audio-row"></div>
      <div class="options" role="group" aria-label="Choose the sentence you heard"></div>
      <div class="feedback-slot"></div>
      <div class="actions"></div>
    </section>`;
  root.querySelector(".audio-row").append(audioButton({ text: sentence.ro, rateNormal: rate }));
  const optsEl = root.querySelector(".options");
  const slot = root.querySelector(".feedback-slot");
  const actions = root.querySelector(".actions");
  let done = false;

  const buttons = options.map((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn secondary option";
    b.lang = "ro";
    b.textContent = s.ro;
    b.dataset.id = s.id;
    b.addEventListener("click", () => choose(s, b));
    optsEl.append(b);
    return b;
  });

  function choose(s, btn) {
    if (done) return;
    done = true;
    const ok = s.id === sentence.id;
    buttons.forEach((b) => {
      b.disabled = true;
      if (b.dataset.id === sentence.id) b.classList.add("correct");
    });
    if (!ok) btn.classList.add("wrong");
    const result = ok ? "correct" : "wrong";
    speak(sentence.ro);
    renderFeedback(slot, {
      result,
      parts: partsFor(sentence.tokens, sentence.ro.split(/\s+/).map((token) => ({ token, status: "ok" }))),
      en: sentence.en,
    });
    nextButtons(actions, {
      canRate: false, // one tap; never moves on by itself
      onPick: (rating) => onResult({ result, usedHint: false, attemptNo: 1, rating }),
    });
  }

  if (settings.autoplay !== false) speak(sentence.ro);
  return () => { done = true; };
}
