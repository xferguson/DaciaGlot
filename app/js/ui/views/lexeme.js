// Lexeme detail (PRD FR-N4): lemma, gloss, key forms with unit-state dots, sentences you've seen.
import { unitState } from "../../core/mastery.js";
import { labelFor } from "../../core/cards.js";

export function lexemeModel(id, state, content, now) {
  const lexeme = content.lexemes.get(id);
  if (!lexeme) return null;
  const forms = (lexeme.keyForms ?? []).map((key) => ({
    key,
    label: labelFor(key),
    text: lexeme.forms?.[key] ?? "",
    state: unitState(`${id}.${key}`, state, content, now),
  }));
  const sentences = (content.sentencesByLexeme.get(id) ?? [])
    .filter((sid) => sid in state.seenSentences)
    .map((sid) => content.sentences.get(sid));
  return { lexeme, forms, sentences };
}

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

export function render(root, ctx) {
  const model = lexemeModel(ctx.route.params.id, ctx.state, ctx.content, Date.now());
  root.replaceChildren();
  const back = el("button", { type: "button", className: "btn secondary block", textContent: "Back" });
  back.addEventListener("click", () => history.back());
  if (!model) {
    root.append(el("p", { className: "muted", textContent: "Unknown word." }), back);
    return;
  }
  const { lexeme, forms, sentences } = model;
  root.append(el("h1", { lang: "ro", textContent: lexeme.lemma }), el("p", { className: "muted", textContent: lexeme.gloss }));
  if (forms.length) {
    const sec = el("section", { className: "card" });
    sec.append(el("h2", { textContent: "Key forms" }));
    for (const f of forms) {
      const dot = el("span", { className: `dot st-${f.state}`, title: f.state });
      dot.setAttribute("role", "img");
      dot.setAttribute("aria-label", f.state);
      const row = el("p", { className: "form-row" });
      row.append(dot, `${f.label}: `, el("span", { lang: "ro", textContent: f.text }));
      sec.append(row);
    }
    root.append(sec);
  }
  const sec = el("section", { className: "card" });
  sec.append(el("h2", { textContent: "Sentences you've seen" }));
  if (!sentences.length) sec.append(el("p", { className: "muted", textContent: "None yet." }));
  for (const s of sentences) {
    const p = el("p");
    p.append(el("span", { lang: "ro", textContent: s.ro }), el("br"), el("span", { className: "muted", textContent: s.en }));
    sec.append(p);
  }
  root.append(sec, back);
}
