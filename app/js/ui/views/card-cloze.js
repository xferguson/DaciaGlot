// Cloze card (PRD FR-D2, FR-D7, FR-D8). Type the blanked token; one retry.

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

/** Token index from a card or id string `cz:<sentenceId>:<idx>`. */
export function tokenIndexOf(card) {
  const id = typeof card === "string" ? card : card.id ?? card.cardId;
  return Number(id.split(":").pop());
}

/** Feedback parts for a sentence with several blanks: each blank shows its own diff, the rest is plain (linkable). */
function partsForBlanks(tokens, diffs) {
  return tokens.flatMap((t, i) => (diffs.has(i)
    ? diffs.get(i).map((d) => ({ token: d.token, status: d.status }))
    : partsFor([t], [{ token: t.t, status: "ok" }])));
}

/**
 * `blanks` (token indices) blanks several tokens at once, for a new sentence's immediate check (FR-R2); by default
 * the card's own token. No audio before answering, so the sentence can't give the blank away (FR-D7); it plays after.
 * `onResult` also gets `blanks: {tokenIndex, ok}[]`.
 */
export function renderCard(root, { card, sentence, tts, settings = {}, onResult, check = false, blanks = null }) {
  const rate = settings.ttsRate ?? 0.9;
  const speak = (text, opts) => tts?.speak?.(text, { rate, ...opts });
  const idxs = blanks?.length ? [...blanks].sort((a, b) => a - b) : [tokenIndexOf(card)];
  const inputs = new Map(idxs.map((i) => {
    const input = answerInput({ size: sentence.tokens[i].t.length + 1, onSubmit: () => check() });
    input.setAttribute("aria-label", "Missing word");
    return [i, input];
  }));
  let lastFocused = inputs.get(idxs[0]);
  for (const input of inputs.values()) input.addEventListener("focus", () => { lastFocused = input; });

  root.innerHTML = `
    <section class="card card-cloze" data-card="${card?.id ?? card ?? ""}">
      <p class="muted"></p>
      <p class="en"></p>
      <p class="cloze-line" lang="ro"></p>
      <div class="bar-slot"></div>
      <div class="hint-line muted" aria-live="polite"></div>
      <div class="feedback-slot"></div>
      <div class="audio-row"></div>
      <div class="actions row"></div>
    </section>`;
  // The immediate check of a new sentence (FR-R2): not scored yet, so no rating.
  root.querySelector(".muted").textContent = check
    ? `Quick check · ${idxs.length > 1 ? `${idxs.length} new words · ` : ""}not scored, the real test is tomorrow`
    : "Fill in the blank";
  root.querySelector(".en").textContent = sentence.en ?? "";
  const line = root.querySelector(".cloze-line");
  sentence.tokens.forEach((t, i) => {
    if (i) line.append(" ");
    line.append(inputs.get(i) ?? t.t);
  });
  root.querySelector(".bar-slot").append(diacriticBar(() => lastFocused));
  const hintLine = root.querySelector(".hint-line");
  const slot = root.querySelector(".feedback-slot");
  const actions = root.querySelector(".actions");

  const checkBtn = Object.assign(document.createElement("button"), { type: "button", className: "btn", textContent: "Check" });
  const hintBtn = Object.assign(document.createElement("button"), { type: "button", className: "btn secondary", textContent: "Hint" });
  actions.append(hintBtn, checkBtn);
  checkBtn.addEventListener("click", () => check());
  hintBtn.addEventListener("click", () => {
    usedHint = true;
    hintLine.textContent = `Hint: ${idxs.map((i) => hintFor(inputs.get(i).value, sentence.tokens[i].t, [])).filter(Boolean).join(" · ")}`;
    lastFocused.focus();
  });

  let attempts = 0;
  let usedHint = false;
  let finished = false;
  const resultOf = (i) => checkAnswer(inputs.get(i).value, sentence.tokens[i].t).result;

  function finish() {
    finished = true;
    const results = idxs.map((i) => ({ tokenIndex: i, result: resultOf(i) }));
    const result = results.some((r) => r.result === "wrong") ? "wrong"
      : results.some((r) => r.result === "correct-diacritics") ? "correct-diacritics" : "correct";
    for (const r of results) {
      const input = inputs.get(r.tokenIndex);
      input.readOnly = true;
      input.classList.toggle("ok", r.result !== "wrong");
      input.classList.toggle("bad", r.result === "wrong");
    }
    actions.replaceChildren();
    hintLine.textContent = "";
    speak(sentence.ro);
    root.querySelector(".audio-row").append(audioButton({ text: sentence.ro, rateNormal: rate }));
    const diffs = new Map(idxs.map((i) => [i, checkAnswer(inputs.get(i).value, sentence.tokens[i].t).diff]));
    renderFeedback(slot, {
      result,
      parts: idxs.length === 1 ? partsFor(sentence.tokens, diffs.get(idxs[0]), idxs[0]) : partsForBlanks(sentence.tokens, diffs),
      en: sentence.en,
    });
    nextButtons(actions, {
      canRate: !check && result !== "wrong" && attempts === 1 && !usedHint,
      onPick: (rating) => onResult({
        result, usedHint, attemptNo: attempts, rating,
        blanks: results.map((r) => ({ tokenIndex: r.tokenIndex, ok: r.result !== "wrong" })),
      }),
    });
  }

  function check() {
    if (finished || idxs.every((i) => !inputs.get(i).value.trim())) return;
    attempts++;
    const wrong = idxs.filter((i) => resultOf(i) === "wrong");
    if (!wrong.length || attempts >= 2) return finish();
    for (const i of idxs) {
      inputs.get(i).classList.toggle("bad", wrong.includes(i));
      if (!wrong.includes(i)) inputs.get(i).readOnly = true;
    }
    slot.replaceChildren();
    const msg = document.createElement("p");
    msg.className = "feedback bad";
    msg.setAttribute("role", "status");
    msg.textContent = wrong.length < idxs.length ? "Not quite: the marked word. Try once more." : "Not quite. Try once more.";
    slot.append(msg);
    const first = inputs.get(wrong[0]);
    first.select();
    first.focus();
  }

  inputs.get(idxs[0]).focus();
  return () => { finished = true; };
}
