// Light feedback (PRD P-8): the expected sentence with wrong tokens marked, no explanations.

/** Pure: build display parts for a full sentence from a checkAnswer diff over one token span. */
export function partsFor(tokens, diff, tokenIndex = null) {
  if (tokenIndex == null) return diff.map((d) => ({ token: d.token, status: d.status }));
  const out = [];
  tokens.forEach((t, i) => {
    if (i === tokenIndex) out.push(...diff.map((d) => ({ token: d.token, status: d.status })));
    else out.push({ token: t.t, status: "ok" });
  });
  return out;
}

export function sentenceView(parts) {
  const p = document.createElement("p");
  p.className = "expected";
  p.lang = "ro";
  parts.forEach((part, i) => {
    if (i) p.append(" ");
    const s = document.createElement("span");
    s.textContent = part.token;
    if (part.status !== "ok") {
      s.className = `tok tok-${part.status}`;
      s.dataset.status = part.status;
    }
    p.append(s);
  });
  return p;
}

/**
 * Render feedback into `root` (replacing its content).
 * `result` is correct | correct-diacritics | wrong. `onTooEasy(on)` shows the chip after a correct answer.
 */
export function renderFeedback(root, { result, parts, en, onTooEasy }) {
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
  if (result !== "wrong" && onTooEasy) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.setAttribute("aria-pressed", "false");
    chip.textContent = "Too easy";
    chip.addEventListener("click", () => {
      const on = chip.getAttribute("aria-pressed") !== "true";
      chip.setAttribute("aria-pressed", String(on));
      onTooEasy(on);
    });
    wrap.append(chip);
  }
  root.append(wrap);
  return wrap;
}
