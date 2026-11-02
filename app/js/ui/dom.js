// Safe markup helpers. Every view that writes markup escapes data through these.

const ENTITIES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Escape a value for HTML text or a quoted attribute; `null`/`undefined` → "". */
export function esc(value) {
  return value == null ? "" : String(value).replace(/[&<>"']/g, (c) => ENTITIES[c]);
}

/** Markup that is already safe. `html` inserts it as is; it coerces to its string (so it can go straight into innerHTML). */
class Raw {
  constructor(markup) { this.markup = markup; }
  toString() { return this.markup; }
  valueOf() { return this.markup; }
}

/** Mark trusted markup so `html` doesn't escape it. `null`/`undefined` → "". */
export const raw = (markup) => new Raw(markup == null ? "" : String(markup));

const part = (v) => (v instanceof Raw ? v.markup : Array.isArray(v) ? v.map(part).join("") : esc(v));

/**
 * Tagged template: escapes every interpolation except `raw(...)` values and nested `html` results.
 * Arrays are joined with no separator; `null`/`undefined` → "". Returns a `raw` value.
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
  return new Raw(out);
}

/** `document.createElement(tag)` with `props` assigned and `children` appended. */
export function el(tag, props = {}, ...children) {
  const node = Object.assign(document.createElement(tag), props);
  if (children.length) node.append(...children);
  return node;
}
