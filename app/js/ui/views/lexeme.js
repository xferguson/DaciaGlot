// Lexeme detail (PRD FR-N4): lemma, gloss, key forms with unit-state dots and claims (FR-R4), sentences you've seen.
import { lexemeModel } from "../models/lexeme.js";
import { claimForm, unclaimForm } from "../../core/session.js";

// The pure model lives in ui/models/lexeme.js (Q13); re-exported here for one release.
export { lexemeModel };

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
    sec.append(el("h2", { textContent: "Forms" }));
    for (const f of forms) {
      const dot = el("span", { className: `dot st-${f.state}`, title: f.state });
      dot.setAttribute("role", "img");
      dot.setAttribute("aria-label", f.state);
      const row = el("p", { className: "form-row" });
      row.append(dot, `${f.label}: `, el("span", { lang: "ro", textContent: f.text }));
      // FR-R4: claim this exact form so it is never tested, or take the claim back.
      const claim = el("button", {
        type: "button", className: "btn secondary", textContent: f.claimed ? "Claimed ✓ · Undo" : "I can produce this",
      });
      claim.style.marginLeft = "auto";
      claim.addEventListener("click", () => {
        ctx.state = f.claimed ? unclaimForm(ctx.state, f.unit, Date.now()) : claimForm(ctx.state, f.unit, Date.now());
        ctx.store.save(ctx.state);
        render(root, ctx);
      });
      row.append(claim);
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
