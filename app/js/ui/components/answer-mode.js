// Answer modes for production cards (T35, FR-V4): speak and self-grade · word tiles · type.
import { tokenize } from "../../core/check.js";
import { tileOptions } from "../../core/cards.js";
import { answerInput } from "./answer-input.js";
import { diacriticBar } from "./diacritic-bar.js";
import { tileBuilder } from "./tiles.js";
import { button } from "./button.js";

export const MODES = [["speak", "Say it"], ["tiles", "Tiles"], ["type", "Type"]];

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

/** Pure: the saved mode, `speak` unless set to another known one. */
export const getMode = (settings = {}) => (MODES.some(([m]) => m === settings.answerMode) ? settings.answerMode : "speak");

/**
 * Pure: a checkAnswer-shaped diff from a speak-mode self-grade. `words` are the expected tokens (strings);
 * tapped indices are marked `wrong`. Same length as the sentence's tokens, so `erMisses` accepts it.
 */
export function tapDiff(words, tapped) {
  const set = tapped instanceof Set ? tapped : new Set(tapped);
  return words.map((token, i) => ({ token, status: set.has(i) ? "wrong" : "ok" }));
}

/** Pure: the words to tap: a sentence's own tokens, or the words of a transform's Romanian `ro`. */
export const wordsOf = (sentence, ro = null) => (ro == null ? sentence.tokens.map((t) => t.t) : tokenize(ro));

/** A small three-way switch. */
export function modeSwitch(current, onPick) {
  const wrap = el("div", { className: "mode-switch", role: "group" });
  wrap.setAttribute("aria-label", "Answer by");
  for (const [m, label] of MODES) {
    const b = button(label, `chip mode-chip${m === current ? " on" : ""}`, () => onPick(m));
    b.setAttribute("aria-pressed", String(m === current));
    wrap.append(b);
  }
  return wrap;
}

/**
 * Draw the answer area for `mode` into the card's `slots` ({mode, input, bar, actions}).
 * Typed/tiles: returns `{input}`; the card reads `input.value` on `onCheck`.
 * Speak: "Reveal", then the Romanian with tappable words; `onSpeakDone(tappedSet)` ends the card.
 */
export function mountAnswer({
  mode, slots, words, label, sentence, content, ro = null, rng = Math.random, size = 12,
  say, onCheck, onHint, onSpeakDone, onMode,
}) {
  const { mode: modeSlot, input: inputSlot, bar: barSlot, actions } = slots;
  modeSlot.replaceChildren(modeSwitch(mode, onMode));
  inputSlot.replaceChildren();
  barSlot.replaceChildren();
  actions.replaceChildren();
  if (mode === "speak") {
    inputSlot.append(el("p", { className: "muted", textContent: "Say the sentence out loud, then reveal." }));
    actions.append(button("Reveal", "btn block", () => {
      say?.();
      modeSlot.replaceChildren();
      const tapped = new Set();
      const done = button("All right", "btn block", () => onSpeakDone(tapped));
      const row = el("p", { className: "expected speak-words", lang: "ro" });
      words.forEach((w, i) => {
        if (i) row.append(" ");
        const b = button(w, "tok-link speak-word", () => {
          if (tapped.has(i)) tapped.delete(i); else tapped.add(i);
          b.classList.toggle("tok-wrong", tapped.has(i));
          b.setAttribute("aria-pressed", String(tapped.has(i)));
          done.textContent = tapped.size ? "Done" : "All right";
        });
        b.setAttribute("aria-pressed", "false");
        row.append(b);
      });
      inputSlot.replaceChildren(el("p", { className: "muted", textContent: "Tap the words you got wrong." }), row);
      actions.replaceChildren(done);
      done.focus();
    }));
    return { input: null };
  }
  const input = mode === "tiles"
    ? tileBuilder({ tiles: tileOptions(sentence, content, rng, ro), label })
    : answerInput({ size, onSubmit: onCheck });
  if (mode === "type") {
    input.setAttribute("aria-label", label);
    barSlot.append(diacriticBar(() => input));
  }
  inputSlot.append(input);
  actions.append(button("Hint", "btn secondary", onHint), button("Check", "btn", onCheck));
  return { input };
}
