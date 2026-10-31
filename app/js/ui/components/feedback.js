// Light feedback (PRD P-8): the expected sentence with wrong tokens marked, no explanations.
import { labelFor } from "../../core/cards.js";

/**
 * Claims (FR-R4): the view that owns the state registers how a tapped token reads and changes claims.
 * `{content, isClaimed(unit), claim(unit), unclaim(unit)}`; without one, tokens are plain word links.
 */
let claims = null;
export function setClaimHandler(handler) {
  claims = handler;
}

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

/** A bottom sheet for one word form: its details, "I can produce this" (or Undo) and a link to the word page. */
export function openFormSheet(unit, token) {
  const { content } = claims;
  const dot = unit.indexOf(".");
  const lexeme = content.lexemes.get(unit.slice(0, dot));
  const form = unit.slice(dot + 1);
  const backdrop = el("div", { className: "sheet-backdrop" });
  const sheet = el("div", { className: "sheet", role: "dialog" });
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", "Word form");
  const close = () => { backdrop.remove(); document.removeEventListener("keydown", onKey); };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) close(); });
  const claimBtn = el("button", { type: "button", className: "btn block" });
  const paint = () => {
    claimBtn.textContent = claims.isClaimed(unit) ? "Claimed ✓ · Undo" : "I can produce this";
    claimBtn.className = claims.isClaimed(unit) ? "btn secondary block" : "btn block";
  };
  paint();
  claimBtn.addEventListener("click", () => {
    if (claims.isClaimed(unit)) claims.unclaim(unit); else claims.claim(unit);
    paint();
  });
  const open = el("a", { className: "btn secondary block", href: `#/lexeme/${encodeURIComponent(unit.slice(0, dot))}`, textContent: "Open word page" });
  open.addEventListener("click", close);
  const done = el("button", { type: "button", className: "btn secondary block", textContent: "Close" });
  done.addEventListener("click", close);
  sheet.append(
    el("h2", { lang: "ro", textContent: token }),
    el("p", { className: "muted", textContent: `${lexeme?.lemma ?? unit.slice(0, dot)} · ${lexeme?.gloss ?? ""} · ${labelFor(form)}` }),
    claimBtn, open, done,
  );
  backdrop.append(sheet);
  document.body.append(backdrop);
  claimBtn.focus();
}

/** Pure: build display parts for a full sentence from a checkAnswer diff over one token span. */
export function partsFor(tokens, diff, tokenIndex = null) {
  const lexOf = (i) => {
    const u = tokens[i]?.units?.[0];
    return u?.lex ? { lex: u.lex, unit: `${u.lex}.${u.form}` } : {};
  };
  if (tokenIndex == null) {
    const linkable = diff.length === tokens.length;
    return diff.map((d, i) => ({ token: d.token, status: d.status, ...(linkable ? lexOf(i) : {}) }));
  }
  const out = [];
  tokens.forEach((t, i) => {
    if (i === tokenIndex) out.push(...diff.map((d) => ({ token: d.token, status: d.status })));
    else out.push({ token: t.t, status: "ok", ...lexOf(i) });
  });
  return out;
}

export function sentenceView(parts) {
  const p = document.createElement("p");
  p.className = "expected";
  p.lang = "ro";
  parts.forEach((part, i) => {
    if (i) p.append(" ");
    const tappable = part.lex && claims && part.unit;
    const s = document.createElement(tappable ? "button" : part.lex ? "a" : "span");
    s.textContent = part.token;
    if (tappable) {
      s.type = "button";
      s.className = "tok-link";
      s.addEventListener("click", () => openFormSheet(part.unit, part.token));
    } else if (part.lex) {
      s.href = `#/lexeme/${encodeURIComponent(part.lex)}`;
      s.className = "tok-link";
    }
    if (part.status !== "ok") {
      s.className = `${s.className} tok tok-${part.status}`.trim();
      s.dataset.status = part.status;
    }
    p.append(s);
  });
  return p;
}

/**
 * Render feedback into `root` (replacing its content).
 * `result` is correct | correct-diacritics | wrong.
 */
export function renderFeedback(root, { result, parts, en }) {
  root.replaceChildren();
  const wrap = document.createElement("div");
  wrap.className = `feedback ${result === "wrong" ? "bad" : "good"}`;
  wrap.setAttribute("role", "status");
  const head = document.createElement("strong");
  head.textContent = result === "wrong" ? "Not quite" : "Corect!";
  wrap.append(head, sentenceView(parts));
  if (en) {
    const e = document.createElement("p");
    e.className = "muted";
    e.textContent = en;
    wrap.append(e);
  }
  if (result === "correct-diacritics") {
    const n = document.createElement("p");
    n.className = "diacritic-note";
    n.textContent = "check the diacritics";
    wrap.append(n);
  }
  root.append(wrap);
  return wrap;
}

/** Self-ratings shown after a clean correct answer (PRD FR-S2); `medium` is the default. */
export const RATINGS = [["hard", "Hard"], ["medium", "Medium"], ["easy", "Easy"]];

/**
 * Append the buttons that end a card to `actions`. With `canRate` (correct on the first try, no hint)
 * they are Hard · Medium · Easy and each calls `onPick(rating)` straight away; otherwise a single
 * Continue calls `onPick(null)`. Focuses the default button so Enter moves on.
 */
export function nextButtons(actions, { canRate, onPick }) {
  const make = (label, cls, rating) => {
    const b = Object.assign(document.createElement("button"), { type: "button", className: cls, textContent: label });
    b.addEventListener("click", () => {
      for (const x of actions.querySelectorAll("button")) x.disabled = true;
      onPick(rating);
    }, { once: true });
    return b;
  };
  if (!canRate) {
    const next = make("Continue", "btn block", null);
    actions.append(next);
    next.focus();
    return;
  }
  const row = document.createElement("div");
  row.className = "row rate";
  row.setAttribute("role", "group");
  row.setAttribute("aria-label", "How hard was that?");
  const buttons = RATINGS.map(([r, label]) => make(label, r === "medium" ? "btn" : "btn secondary", r));
  row.append(...buttons);
  actions.append(row);
  buttons[1].focus();
}
