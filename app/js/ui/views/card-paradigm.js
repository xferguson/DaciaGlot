// Paradigm card (PRD FR-R5): a family of near-identical sentences shown once as a small table.
// Each row has audio, the Romanian with the differing word highlighted and labelled, and the English.

import { differingToken } from "../../core/families.js";
import { labelFor } from "../../core/cards.js";
import { audioButton } from "../components/audio-button.js";

/** Pure: one row per member: `{id, ro, en, token, label}` (`token`/`label` are null when no word differs). */
export function paradigmRows(members, content) {
  return members.map((id) => {
    const s = content.sentences.get(id);
    const d = differingToken(s, (content.families.get(content.familyOf.get(id)) ?? []).filter((m) => m !== id), content.sentences);
    return { id, ro: s.ro, en: s.en, token: d?.token ?? null, label: d ? labelFor(d.unit.slice(d.unit.indexOf(".") + 1)) : null };
  });
}

export function renderCard(root, { members, content, tts, settings = {}, onResult }) {
  const rate = settings.ttsRate ?? 0.9;
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
  const go = Object.assign(document.createElement("button"), { type: "button", className: "btn", textContent: "Continue" });
  go.addEventListener("click", () => onResult({ result: "correct", usedHint: false, attemptNo: 1, rating: null }));
  root.querySelector(".actions").append(go);
  if (settings.autoplay !== false) tts?.speak?.(content.sentences.get(members[0]).ro, { rate });
  return () => {};
}
