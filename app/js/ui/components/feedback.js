// Light feedback (PRD P-8): the expected sentence with wrong tokens marked, no explanations.

/** Pure: build display parts for a full sentence from a checkAnswer diff over one token span. */
export function partsFor(tokens, diff, tokenIndex = null) {
  const lexOf = (i) => tokens[i]?.units?.[0]?.lex;
  if (tokenIndex == null) {
    const linkable = diff.length === tokens.length;
    return diff.map((d, i) => ({ token: d.token, status: d.status, ...(linkable && lexOf(i) ? { lex: lexOf(i) } : {}) }));
  }
  const out = [];
  tokens.forEach((t, i) => {
    if (i === tokenIndex) out.push(...diff.map((d) => ({ token: d.token, status: d.status })));
    else out.push({ token: t.t, status: "ok", ...(lexOf(i) ? { lex: lexOf(i) } : {}) });
  });
  return out;
}

export function sentenceView(parts) {
  const p = document.createElement("p");
  p.className = "expected";
  p.lang = "ro";
  parts.forEach((part, i) => {
    if (i) p.append(" ");
    const s = document.createElement(part.lex ? "a" : "span");
    s.textContent = part.token;
    if (part.lex) {
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
  head.textContent = result === "wrong" ? "Not quite" : "Correct!";
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
