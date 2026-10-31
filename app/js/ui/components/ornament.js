// Small painted spot illustrations (inline SVG strings). Fixed colors read on both the cream and the cobalt theme.
// Each is decorative: aria-hidden, no text.
const INK = "#0b2a6f";
const svg = (cls, vb, body) =>
  `<svg class="spot ${cls}" viewBox="${vb}" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

/** Horezu-style rooster, for Home. */
export function rooster(cls = "spot-hero") {
  return svg(cls, "-110 -110 220 220", `<g stroke-linecap="round" stroke-linejoin="round">
<path d="M-34 -4C-70 -18-86 -58-74 -92" fill="none" stroke="#2e7d4f" stroke-width="9"/>
<path d="M-30 6C-74 6-98 -20-96 -60" fill="none" stroke="#1f4e9c" stroke-width="9"/>
<path d="M-28 16C-66 28-92 14-100 -14" fill="none" stroke="#ce1126" stroke-width="9"/>
<ellipse cx="0" cy="14" rx="46" ry="38" fill="#fff4df" stroke="${INK}" stroke-width="3"/>
<path d="M-26 8C-8 -6 18 2 24 24 4 40-22 34-26 8Z" fill="#1f4e9c"/>
<path d="M26 -2C30 -30 34 -46 40 -58" fill="none" stroke="${INK}" stroke-width="26"/>
<path d="M26 -2C30 -30 34 -46 40 -58" fill="none" stroke="#fff4df" stroke-width="21"/>
<circle cx="42" cy="-62" r="18" fill="#fff4df" stroke="${INK}" stroke-width="3"/>
<path d="M30 -78a7 7 0 1 1 10-6 7 7 0 1 1 11-2 7 7 0 1 1 8 8" fill="none" stroke="#ce1126" stroke-width="8"/>
<path d="M58 -64L80 -58 58 -52Z" fill="#d9a23b"/><path d="M50 -50q4 16-2 22" fill="none" stroke="#ce1126" stroke-width="7"/>
<circle cx="46" cy="-66" r="3.2" fill="${INK}"/>
<path d="M-6 50L-10 84M10 50L14 84M-18 86h14M2 86h16" stroke="#d9a23b" stroke-width="5" fill="none"/></g>`);
}

/** Tulip, for the Done screen. */
export function tulip(cls = "spot-center") {
  return svg(cls, "-90 -80 180 200", `<g stroke-linecap="round">
<path d="M0 -60C-34 -28-30 22 0 44 30 22 34 -28 0 -60Z" fill="#ce1126"/>
<path d="M0 44C-46 38-70 -14-58 -52-24 -40-4 -4 0 44Z" fill="#d9a23b"/>
<path d="M0 44C46 38 70 -14 58 -52 24 -40 4 -4 0 44Z" fill="#d9a23b"/>
<path d="M0 44L0 110" stroke="#2e7d4f" stroke-width="7"/>
<path d="M0 100C-30 96-46 74-48 56-22 62-6 80 0 100Z" fill="#2e7d4f"/>
<path d="M0 92C30 88 46 66 48 48 22 54 6 72 0 92Z" fill="#2e7d4f"/></g>`);
}

/** Sun with a face, for empty states. */
export function sun(cls = "spot-center") {
  const rays = Array.from({ length: 12 }, (_, i) => `<path d="M0-60l8-16h-16Z" fill="#d9a23b" transform="rotate(${i * 30})"/>`).join("");
  return svg(cls, "-90 -90 180 180", `${rays}<circle r="52" fill="#d9a23b"/><circle r="34" fill="none" stroke="#ce1126" stroke-width="3"/>
<path d="M-18-6q18-16 36 0" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
<path d="M-16 12q16 14 32 0" fill="none" stroke="#ce1126" stroke-width="4" stroke-linecap="round"/>`);
}
