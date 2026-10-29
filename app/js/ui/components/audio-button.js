// Speaker button: tap = normal rate, long-press (≥450 ms) = slow.

import { speak, DEFAULT_RATE } from "../../data/tts.js";

const LONG_PRESS_MS = 450;

export function audioButton({ text, rateNormal = DEFAULT_RATE, rateSlow = 0.7 }) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "btn secondary audio-btn";
  b.style.minWidth = "44px";
  b.style.minHeight = "44px";
  b.setAttribute("aria-label", "Play audio (hold for slow)");
  b.textContent = "🔊";

  let timer = null;
  let longPressed = false;

  const play = async (rate) => {
    b.setAttribute("aria-pressed", "true");
    b.textContent = "⏸";
    await speak(text, { rate });
    b.setAttribute("aria-pressed", "false");
    b.textContent = "🔊";
  };

  const start = () => {
    longPressed = false;
    clearTimeout(timer);
    timer = setTimeout(() => {
      longPressed = true;
      play(rateSlow);
    }, LONG_PRESS_MS);
  };
  const cancel = () => clearTimeout(timer);

  b.addEventListener("pointerdown", start);
  b.addEventListener("pointerup", cancel);
  b.addEventListener("pointerleave", cancel);
  b.addEventListener("pointercancel", cancel);
  b.addEventListener("contextmenu", (e) => e.preventDefault());
  b.addEventListener("click", () => {
    if (longPressed) {
      longPressed = false;
      return;
    }
    play(rateNormal);
  });
  b.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      play(rateSlow);
    }
  });
  return b;
}
