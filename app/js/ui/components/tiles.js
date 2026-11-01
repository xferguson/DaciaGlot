// Word tiles (T35, FR-V4): tap tiles to build the sentence. Behaves like a text input for the cards:
// `value`, `readOnly`, `select()` (start over), `focus()`, `classList`.

const el = (tag, props = {}) => Object.assign(document.createElement(tag), props);

export function tileBuilder({ tiles, label = "Sentence" }) {
  const root = el("div", { className: "tile-builder" });
  root.setAttribute("aria-label", label);
  const line = el("div", { className: "tile-line", lang: "ro" });
  line.setAttribute("aria-live", "polite");
  const bank = el("div", { className: "tile-bank", lang: "ro" });
  root.append(line, bank);
  let picked = []; // indices into `tiles`, in tap order
  let locked = false;

  const make = (i, inLine) => {
    const b = el("button", { type: "button", className: "tile", textContent: tiles[i], disabled: locked });
    b.addEventListener("click", () => {
      if (locked) return;
      picked = inLine ? picked.filter((x) => x !== i) : [...picked, i];
      paint();
    });
    return b;
  };
  function paint() {
    line.replaceChildren(...picked.map((i) => make(i, true)));
    line.classList.toggle("empty", !picked.length);
    bank.replaceChildren(...tiles.map((_, i) => i).filter((i) => !picked.includes(i)).map((i) => make(i, false)));
  }
  paint();

  Object.defineProperty(root, "value", { get: () => picked.map((i) => tiles[i]).join(" ") });
  Object.defineProperty(root, "readOnly", {
    get: () => locked,
    set(v) { locked = !!v; paint(); },
  });
  root.select = () => { picked = []; paint(); };
  root.focus = () => bank.querySelector("button")?.focus();
  return root;
}
