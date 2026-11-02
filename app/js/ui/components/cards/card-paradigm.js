// Paradigm card (PRD FR-R5): a family of near-identical sentences shown once as a small table.
// Each row has audio, the Romanian with the differing word highlighted and labelled, and the English.

import { speechFor } from "../speech.js";
import { paradigmRows } from "../../models/card-paradigm.js";
import { audioButton } from "../audio-button.js";
import { advanceButton } from "../button.js";

export { paradigmRows };

export function renderCard(root, { members, content, speak: speakIn, rate: rateIn, tts, settings = {}, onResult }) {
  const { speak, rate } = speechFor({ speak: speakIn, rate: rateIn, tts, settings });
  root.innerHTML = `
    <section class="card card-paradigm">
      <p class="muted">One idea, several forms. Listen to each, then notice what changes.</p>
      <ul class="paradigm-rows"></ul>
      <div class="actions"></div>
    </section>`;
  const list = root.querySelector(".paradigm-rows");
  for (const row of paradigmRows(members, content)) {
    const li = document.createElement("li");
    li.className = "paradigm-row";
    const text = document.createElement("div");
    const ro = document.createElement("p");
    ro.lang = "ro";
    ro.className = "ro";
    const at = row.token ? row.ro.indexOf(row.token) : -1;
    if (at >= 0) {
      const mark = document.createElement("mark");
      mark.textContent = row.token;
      ro.append(row.ro.slice(0, at), mark, row.ro.slice(at + row.token.length));
    } else ro.textContent = row.ro;
    const en = document.createElement("p");
    en.className = "muted";
    en.textContent = row.label ? `${row.en} · ${row.label}` : row.en;
    text.append(ro, en);
    li.append(audioButton({ text: row.ro, rateNormal: rate }), text);
    list.append(li);
  }
  const actions = root.querySelector(".actions");
  actions.append(advanceButton("Continue", "btn block", () => onResult({ result: "correct", usedHint: false, attemptNo: 1, rating: null }), actions));
  if (settings.autoplay !== false) speak(content.sentences.get(members[0]).ro);
  return () => {};
}
