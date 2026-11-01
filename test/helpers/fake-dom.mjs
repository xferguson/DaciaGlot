// Minimal DOM stand-in (no dependencies) for exercising button wiring in node:test.
export class FakeEl {
  constructor(tag) { this.tag = tag; this.children = []; this.parent = null; this.handlers = {}; this.disabled = false; this.attrs = {}; this.textContent = ""; this.className = ""; this.style = {}; }
  get isConnected() { let n = this; while (n.parent) n = n.parent; return n.isRoot === true; }
  append(...kids) { for (const k of kids) { k.parent = this; this.children.push(k); } }
  replaceChildren(...kids) { this.children.forEach((k) => { k.parent = null; }); this.children = []; this.append(...kids); }
  remove() { if (this.parent) { this.parent.children = this.parent.children.filter((c) => c !== this); this.parent = null; } }
  setAttribute(k, v) { this.attrs[k] = v; }
  focus() {}
  addEventListener(type, fn, opts = {}) { (this.handlers[type] ??= []).push({ fn, once: !!opts.once }); }
  dispatch(type) {
    // bubbles up like a real pointer/click event
    for (let n = this; n; n = n.parent) {
      for (const h of [...(n.handlers[type] ?? [])]) { if (h.once) n.handlers[type].splice(n.handlers[type].indexOf(h), 1); h.fn({ target: this }); }
    }
  }
  /** A real click on a disabled button does nothing. */
  click() { if (!this.disabled) this.dispatch("click"); }
  querySelectorAll(sel) {
    const out = [];
    const walk = (n) => { for (const c of n.children) { if (c.tag === sel) out.push(c); walk(c); } };
    walk(this);
    return out;
  }
}
export function installFakeDom() {
  globalThis.document = { createElement: (t) => new FakeEl(t) };
  const root = new FakeEl("div");
  root.isRoot = true;
  return root;
}
