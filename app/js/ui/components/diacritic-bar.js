// ă â î ș ț buttons that insert at the caret of a text input (PRD FR-A5).
// Tap inserts lowercase, long-press (≥450 ms) inserts uppercase.

const LETTERS = ["ă", "â", "î", "ș", "ț"];
const LONG_PRESS_MS = 450;

/** Pure: returns the new value and caret after inserting `ch` over the selection. */
export function insertAt(value, start, end, ch) {
  const s = Math.min(start ?? value.length, end ?? value.length);
  const e = Math.max(start ?? value.length, end ?? value.length);
  return { value: value.slice(0, s) + ch + value.slice(e), caret: s + ch.length };
}

/** `getInput()` returns the input to edit (so the bar can outlive input re-renders). */
export function diacriticBar(getInput) {
  const bar = document.createElement("div");
  bar.className = "diacritic-bar";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Romanian letters (hold for capital)");
  for (const letter of LETTERS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn secondary diacritic-key";
    b.lang = "ro";
    b.textContent = letter;
    let timer = null;
    let long = false;
    const insert = (ch) => {
      const input = getInput();
      if (!input) return;
      const r = insertAt(input.value, input.selectionStart, input.selectionEnd, ch);
      input.value = r.value;
      input.focus();
      input.setSelectionRange(r.caret, r.caret);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };
    // Keep focus (and the on-screen keyboard) in the input.
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      long = false;
      clearTimeout(timer);
      timer = setTimeout(() => { long = true; insert(letter.toUpperCase()); }, LONG_PRESS_MS);
    });
    const cancel = () => clearTimeout(timer);
    b.addEventListener("pointerup", cancel);
    b.addEventListener("pointerleave", cancel);
    b.addEventListener("pointercancel", cancel);
    b.addEventListener("mousedown", (e) => e.preventDefault());
    b.addEventListener("contextmenu", (e) => e.preventDefault());
    b.addEventListener("click", () => {
      if (long) { long = false; return; }
      insert(letter);
    });
    bar.append(b);
  }
  return bar;
}
