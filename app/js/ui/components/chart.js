// Inline-SVG charts without a library. Colors come from CSS classes (tokens in app.css); axes are labelled.
const NS = "http://www.w3.org/2000/svg";
const W = 320;
const H = 170;
const M = { l: 36, r: 8, t: 8, b: 44 };

const el = (name, attrs = {}, text) => {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};

/** A "nice" axis maximum ≥ `max` (1, 2, 5 × 10^k), so ticks land on round numbers. */
export function niceMax(max) {
  if (!(max > 0)) return 1;
  const p = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (m * p >= max) return m * p;
  return 10 * p;
}

function frame({ title, xLabel, yLabel, yMax, desc }) {
  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": title });
  svg.append(el("title", {}, title), el("desc", {}, desc));
  const ih = H - M.t - M.b;
  for (const f of [0, 0.5, 1]) {
    const y = M.t + ih * (1 - f);
    svg.append(el("line", { x1: M.l, x2: W - M.r, y1: y, y2: y, class: "chart-grid" }), el("text", { x: M.l - 4, y, class: "chart-tick", "text-anchor": "end", "dominant-baseline": "central" }, String(+(yMax * f).toFixed(1))));
  }
  svg.append(
    el("text", { x: (M.l + W - M.r) / 2, y: H - 4, class: "chart-axis", "text-anchor": "middle" }, xLabel),
    el("text", { x: 10, y: M.t + ih / 2, class: "chart-axis", "text-anchor": "middle", transform: `rotate(-90 10 ${M.t + ih / 2})` }, yLabel),
  );
  return svg;
}

const desc = (data) => data.map((d) => `${d.label}: ${d.value}`).join(", ");

/**
 * `barChart({ data: [{label, value}], title, xLabel, yLabel, labelEvery })` → SVG element.
 * `labelEvery` thins the x tick labels (every nth bar).
 */
export function barChart({ data, title, xLabel, yLabel, labelEvery = 1 }) {
  const yMax = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const svg = frame({ title, xLabel, yLabel, yMax, desc: desc(data) });
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const slot = iw / Math.max(data.length, 1);
  data.forEach((d, i) => {
    const h = (d.value / yMax) * ih;
    const x = M.l + slot * i + slot * 0.15;
    svg.append(el("rect", { x, y: M.t + ih - h, width: slot * 0.7, height: Math.max(h, 0), class: "chart-bar", rx: 2 }));
    if (i % labelEvery === 0) svg.append(el("text", { x: x + slot * 0.35, y: M.t + ih + 12, class: "chart-tick", "text-anchor": "middle" }, d.label));
  });
  return svg;
}

/**
 * `lineChart({ data: [{label, value|null}], title, xLabel, yLabel, yMax })` → SVG element. `null` values
 * break the line (a week with no attempts).
 */
export function lineChart({ data, title, xLabel, yLabel, yMax = 100 }) {
  const svg = frame({ title, xLabel, yLabel, yMax, desc: desc(data.map((d) => ({ ...d, value: d.value ?? "no data" }))) });
  const iw = W - M.l - M.r;
  const ih = H - M.t - M.b;
  const step = data.length > 1 ? iw / (data.length - 1) : 0;
  const pt = (d, i) => [M.l + (data.length > 1 ? step * i : iw / 2), M.t + ih * (1 - d.value / yMax)];
  let run = [];
  const flush = () => {
    if (run.length > 1) svg.append(el("polyline", { points: run.map((p) => p.join(",")).join(" "), class: "chart-line" }));
    run = [];
  };
  data.forEach((d, i) => {
    svg.append(el("text", { x: M.l + (data.length > 1 ? step * i : iw / 2), y: M.t + ih + 12, class: "chart-tick", "text-anchor": "middle" }, d.label));
    if (d.value == null) return flush();
    const p = pt(d, i);
    run.push(p);
    svg.append(el("circle", { cx: p[0], cy: p[1], r: 3, class: "chart-dot" }));
  });
  flush();
  return svg;
}
