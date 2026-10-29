// Progress ring as inline SVG (PRD FR-P5). Colors come from CSS tokens, so it follows light/dark mode.
const NS = "http://www.w3.org/2000/svg";
const R = 42;
const C = 2 * Math.PI * R;

const el = (name, attrs = {}) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
};

/** Dash length of the arc for a percentage (clamped to 0..100). Exported for tests. */
export const arcLength = (percent) => (Math.max(0, Math.min(100, percent)) / 100) * C;

/** `ring({ percent, label, size })` → SVG element: a track, a progress arc and the label in the middle. */
export function ring({ percent, label, size = 96 }) {
  const svg = el("svg", { viewBox: "0 0 100 100", width: size, height: size, class: "ring-svg", role: "img", "aria-label": `${label} ${Math.round(percent)}%` });
  svg.append(
    el("circle", { cx: 50, cy: 50, r: R, class: "ring-track" }),
    el("circle", { cx: 50, cy: 50, r: R, class: "ring-arc", "stroke-dasharray": `${arcLength(percent)} ${C}`, transform: "rotate(-90 50 50)" }),
  );
  const text = el("text", { x: 50, y: 50, class: "ring-label", "text-anchor": "middle", "dominant-baseline": "central" });
  text.textContent = label;
  svg.append(text);
  return svg;
}
