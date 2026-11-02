// Slot-building card (PRD FR-D5, FR-D7, FR-D8). Slots derived from a transform; type the whole sentence; one retry.

import { parseCardId, slotsFor, lexemeForms } from "../../../core/cards.js";
import { answerCard } from "../answer-card.js";

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
  const cleanup = answerCard(root, {
    cls: "card-slot", dataCard: `${sentence.id}:${transformIndex}`, audio: "end", label: "Sentence",
    header: '<p class="muted">Build the sentence</p><p class="en"></p><p class="slot-line" lang="ro"></p>',
    expected: t.ro, accept: t.accept, avoid: content ? lexemeForms(sentence, content) : [], ro: t.ro,
    sentence, content, rng, settings, en: t.en ?? null, onResult, onSetting,
    speak: (text, opts) => tts?.speak?.(text, { rate, ...opts }),
  });
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
  return cleanup;
}
