// Listen & recognize card (PRD FR-D1, FR-D7). Pick the text that matches the audio.

import { audioButton } from "../components/audio-button.js";
import { renderFeedback, nextButtons, partsFor } from "../components/feedback.js";

export function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const lexemesOf = (s) => [...new Set(s.tokens.flatMap((t) => t.units.map((u) => u.lex)))];

/**
 * Pure. Up to 3 distractor sentences, never the answer or a sentence with identical text.
 * Preference: shares a lexeme, then shares a pattern, then same situation, then anything.
 */
export function pickDistractors(sentence, content, rng = Math.random, count = 3) {
  const taken = new Set([sentence.id]);
  const texts = new Set([sentence.ro]);
  const out = [];
  const tiers = [
    () => lexemesOf(sentence).flatMap((l) => content.sentencesByLexeme?.get(l) ?? []),
    () => (sentence.patterns ?? []).flatMap((p) => content.sentencesByPattern?.get(p) ?? []),
    () => (sentence.situations ?? []).flatMap((s) => content.sentencesBySituation?.get(s) ?? []),
    () => [...content.sentences.keys()],
  ];
  for (const tier of tiers) {
    const ids = shuffle([...new Set(tier())].filter((id) => !taken.has(id)), rng);
    for (const id of ids) {
      if (out.length >= count) return out;
      const s = content.sentences.get(id);
      if (!s || texts.has(s.ro)) continue;
      taken.add(id);
      texts.add(s.ro);
      out.push(s);
    }
  }
  return out;
}

export function renderCard(root, { card, sentence, content, tts, settings = {}, onResult, rng = Math.random }) {
  const rate = settings.ttsRate ?? 0.9;
  const speak = (text, opts) => tts?.speak?.(text, { rate, ...opts });
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
      canRate: result !== "wrong",
      onPick: (rating) => onResult({ result, usedHint: false, attemptNo: 1, rating }),
    });
  }

  if (settings.autoplay !== false) speak(sentence.ro);
  return () => { done = true; };
}
