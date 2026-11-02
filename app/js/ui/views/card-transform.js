// Transformation card (PRD FR-D4, FR-D7, FR-D8). Type the whole changed sentence; one retry.

import { parseCardId, opInstruction, lexemeForms } from "../../core/cards.js";
import { audioButton } from "../components/audio-button.js";
import { answerCard } from "../components/answer-card.js";

export function renderCard(root, { card, sentence, content, tts, settings = {}, onResult, onSetting, rng = Math.random }) {
  const { transformIndex } = parseCardId(typeof card === "string" ? card : card.id ?? card.cardId);
  const t = sentence.transforms[transformIndex];
  const rate = settings.ttsRate ?? 0.9;
  const speak = (text, opts) => tts?.speak?.(text, { rate, ...opts });
  if (settings.autoplay !== false) speak(sentence.ro);
  const cleanup = answerCard(root, {
    cls: "card-transform", dataCard: `${sentence.id}:${transformIndex}`, label: "Changed sentence",
    header: `<p class="muted">Transform</p><p class="xf-source" lang="ro"></p><div class="audio-row"></div>
      <p class="xf-instruction"><strong></strong></p><p class="muted xf-en"></p>`,
    expected: t.ro, accept: t.accept, avoid: content ? lexemeForms(sentence, content) : [], ro: t.ro,
    sentence, content, rng, settings, en: t.en ?? null, onResult, onSetting, speak,
  });
  root.querySelector(".xf-source").textContent = sentence.ro;
  root.querySelector(".xf-instruction strong").textContent = opInstruction(t.op);
  root.querySelector(".audio-row").append(audioButton({ text: sentence.ro, rateNormal: rate }));
  return cleanup;
}
