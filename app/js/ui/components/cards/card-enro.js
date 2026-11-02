// EN→RO card (PRD FR-D6, FR-D7, FR-D8, FR-V4). Shows the English; answer by speaking and self-grading, by word tiles,
// or by typing the whole Romanian sentence (one retry). Audio is hidden until the answer is revealed.

import { speechFor } from "../speech.js";
import { hintFor } from "../../../core/check.js";
import { lexemeForms } from "../../../core/cards.js";
import { erMisses } from "../../../core/session.js";
import { answerCard } from "../answer-card.js";

export { hintFor };

export function renderCard(root, { card, sentence, content, speak: speakIn, rate: rateIn, tts, settings = {}, label, onResult, onSetting, rng = Math.random }) {
  const { speak, rate } = speechFor({ speak: speakIn, rate: rateIn, tts, settings });
  const cleanup = answerCard(root, {
    cls: "card-enro", dataCard: card?.id ?? card ?? "", audio: "mid", label: "Romanian sentence",
    header: '<p class="muted"></p><p class="en"><strong></strong></p>',
    expected: sentence.ro, accept: sentence.accept ?? [], avoid: content ? lexemeForms(sentence, content) : [],
    sentence, content, rng, settings, partTokens: sentence.tokens, en: sentence.en, onResult, onSetting,
    speak,
    extras(diff, slot) {
      const misses = erMisses(sentence, diff);
      if (misses?.missedTokens.length) {
        const note = document.createElement("p");
        note.className = "muted";
        note.textContent = `${misses.missedTokens.join(", ")} will be reviewed on its own.`;
        slot.append(note);
      }
      return { diff };
    },
  });
  root.querySelector(".en strong").textContent = sentence.en ?? "";
  root.querySelector("p.muted").textContent = label ? `${label} · say it in Romanian` : "Say it in Romanian";
  return cleanup;
}
