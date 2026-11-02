// Minimal DOM stand-in (no dependencies) for exercising views and button wiring in node:test.
// Covers what the views use: elements and text nodes, a tiny `innerHTML` parser, simple selectors
// (`tag`, `.class`, `#id`, `[attr]`, `[attr="v"]`, compounds like `tag.class`, and descendant chains),
// `classList`, `dataset`, events that bubble, `replaceWith`, `value`, `readOnly`, `select()`.

const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
const decode = (s) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => {
  if (e[0] === "#") return String.fromCodePoint(e[1] === "x" || e[1] === "X" ? parseInt(e.slice(2), 16) : Number(e.slice(1)));
  return ENTITIES[e] ?? m;
});
const VOID = new Set(["input", "br", "img", "hr", "meta", "link", "source", "wbr"]);

export class FakeText {
  constructor(data) { this.nodeType = 3; this.data = String(data); this.parent = null; }
  get textContent() { return this.data; }
  set textContent(v) { this.data = String(v); }
  get parentNode() { return this.parent; }
  remove() { this.parent?._removeChild(this); }
}

class ClassList {
  constructor(el) { this.el = el; }
  get list() { return this.el._class.split(/\s+/).filter(Boolean); }
  set list(l) { this.el._class = [...new Set(l)].join(" "); }
  contains(c) { return this.list.includes(c); }
  add(...cs) { this.list = [...this.list, ...cs]; }
  remove(...cs) { this.list = this.list.filter((c) => !cs.includes(c)); }
  toggle(c, force) {
    const on = force === undefined ? !this.contains(c) : !!force;
    if (on) this.add(c); else this.remove(c);
    return on;
  }
  get length() { return this.list.length; }
  [Symbol.iterator]() { return this.list[Symbol.iterator](); }
}

export class FakeEl {
  constructor(tag) {
    this.nodeType = 1;
    this.tag = String(tag).toLowerCase();
    this.childNodes = [];
    this.parent = null;
    this.handlers = {};
    this.disabled = false;
    this.attrs = {};
    this._class = "";
    this.style = {};
    this.dataset = {};
    this.classList = new ClassList(this);
    this.focusCount = 0;
    this.selectCount = 0;
    if (this.tag === "input" || this.tag === "textarea") { this.value = ""; this.readOnly = false; }
  }
  get tagName() { return this.tag.toUpperCase(); }
  get className() { return this._class; }
  set className(v) { this._class = String(v); }
  get children() { return this.childNodes.filter((n) => n.nodeType === 1); }
  get firstChild() { return this.childNodes[0] ?? null; }
  get firstElementChild() { return this.children[0] ?? null; }
  get parentNode() { return this.parent; }
  get parentElement() { return this.parent; }
  get isConnected() { let n = this; while (n.parent) n = n.parent; return n.isRoot === true; }
  get textContent() { return this.childNodes.map((n) => n.textContent).join(""); }
  set textContent(v) { this._clear(); if (v !== "" && v != null) this.append(String(v)); }
  get innerText() { return this.textContent; }
  set innerHTML(html) { this._clear(); this.append(...parseHtml(String(html))); }
  get innerHTML() { return this.childNodes.map(serialize).join(""); }
  get outerHTML() { return serialize(this); }

  _clear() { this.childNodes.forEach((k) => { k.parent = null; }); this.childNodes = []; }
  _removeChild(k) { this.childNodes = this.childNodes.filter((c) => c !== k); k.parent = null; }
  append(...kids) {
    for (let k of kids) {
      if (!(k instanceof FakeEl || k instanceof FakeText)) k = new FakeText(k);
      k.parent?._removeChild(k);
      k.parent = this;
      this.childNodes.push(k);
    }
  }
  appendChild(k) { this.append(k); return k; }
  prepend(...kids) { const rest = this.childNodes; this.childNodes = []; this.append(...kids); this.childNodes.push(...rest); }
  replaceChildren(...kids) { this._clear(); this.append(...kids); }
  replaceWith(...nodes) {
    const p = this.parent;
    if (!p) return;
    const at = p.childNodes.indexOf(this);
    p._removeChild(this);
    const tail = p.childNodes.splice(at);
    p.append(...nodes);
    p.childNodes.push(...tail);
  }
  remove() { this.parent?._removeChild(this); }
  contains(n) { for (; n; n = n.parent) if (n === this) return true; return false; }

  setAttribute(k, v) {
    v = String(v);
    if (k === "class") this._class = v;
    else if (k.startsWith("data-")) this.dataset[camel(k.slice(5))] = v;
    else this.attrs[k] = v;
  }
  getAttribute(k) {
    if (k === "class") return this._class || null;
    if (k.startsWith("data-")) return this.dataset[camel(k.slice(5))] ?? null;
    return k in this.attrs ? this.attrs[k] : null;
  }
  hasAttribute(k) { return this.getAttribute(k) !== null; }
  removeAttribute(k) {
    if (k === "class") this._class = "";
    else if (k.startsWith("data-")) delete this.dataset[camel(k.slice(5))];
    else delete this.attrs[k];
  }

  focus() {
    this.focusCount++;
    if (globalThis.document) globalThis.document.activeElement = this;
    for (const h of [...(this.handlers.focus ?? [])]) h.fn({ type: "focus", target: this });
  }
  blur() {}
  select() { this.selectCount++; }
  setSelectionRange(s, e) { this.selectionStart = s; this.selectionEnd = e; }

  addEventListener(type, fn, opts = {}) { (this.handlers[type] ??= []).push({ fn, once: !!opts.once }); }
  removeEventListener(type, fn) { this.handlers[type] = (this.handlers[type] ?? []).filter((h) => h.fn !== fn); }
  /** Bubbles up like a real pointer/click event. `props` are merged into the event (e.g. `{key: "Enter"}`). */
  dispatch(type, props = {}) {
    let stopped = false;
    const ev = {
      type, target: this, defaultPrevented: false, ...props,
      preventDefault() { ev.defaultPrevented = true; },
      stopPropagation() { stopped = true; },
    };
    for (let n = this; n && !stopped; n = n.parent) {
      ev.currentTarget = n;
      for (const h of [...(n.handlers[type] ?? [])]) {
        if (h.once) n.handlers[type].splice(n.handlers[type].indexOf(h), 1);
        h.fn(ev);
      }
    }
    return !ev.defaultPrevented;
  }
  dispatchEvent(e) { return this.dispatch(e.type); }
  /** A real click on a disabled button does nothing. */
  click() { if (!this.disabled) this.dispatch("click"); }

  querySelectorAll(sel) {
    const chains = sel.split(",").map((s) => parseSelector(s.trim()));
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        if (chains.some((ch) => matchChain(c, ch, this))) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  querySelector(sel) { return this.querySelectorAll(sel)[0] ?? null; }
  matches(sel) { return sel.split(",").some((s) => matchChain(this, parseSelector(s.trim()), null)); }
  closest(sel) { for (let n = this; n instanceof FakeEl; n = n.parent) if (n.matches(sel)) return n; return null; }
}

// ---------- selectors ----------

function parseCompound(s) {
  const c = { tag: null, id: null, classes: [], attrs: [] };
  const re = /^([a-zA-Z][\w-]*|\*)|\.([\w-]+)|#([\w-]+)|\[([\w-]+)(?:([~^$*]?=)"?([^"\]]*)"?)?\]/g;
  let m;
  let used = 0;
  while ((m = re.exec(s))) {
    if (m.index !== used) break;
    used = re.lastIndex;
    if (m[1]) c.tag = m[1] === "*" ? null : m[1].toLowerCase();
    else if (m[2]) c.classes.push(m[2]);
    else if (m[3]) c.id = m[3];
    else c.attrs.push({ name: m[4], op: m[5], value: m[6] });
  }
  if (used !== s.length) throw new Error(`fake-dom: unsupported selector "${s}"`);
  return c;
}
const parseSelector = (s) => s.split(/\s+/).filter(Boolean).map(parseCompound);

function attrValue(el, name) {
  const a = el.getAttribute(name);
  if (a !== null) return a;
  const p = name === "readonly" ? "readOnly" : name;
  if (["hidden", "disabled", "readOnly", "type", "lang", "role", "href", "title", "id"].includes(p) && el[p] !== undefined && el[p] !== false && el[p] !== "") {
    return el[p] === true ? "" : String(el[p]);
  }
  return null;
}

function matchCompound(el, c) {
  if (c.tag && el.tag !== c.tag) return false;
  if (c.id && (el.id ?? el.attrs.id) !== c.id) return false;
  for (const k of c.classes) if (!el.classList.contains(k)) return false;
  for (const { name, op, value } of c.attrs) {
    const v = attrValue(el, name);
    if (v === null) return false;
    if (op === "=" && v !== value) return false;
    if (op === "~=" && !v.split(/\s+/).includes(value)) return false;
    if (op === "^=" && !v.startsWith(value)) return false;
    if (op === "$=" && !v.endsWith(value)) return false;
    if (op === "*=" && !v.includes(value)) return false;
  }
  return true;
}

/** Descendant chain: the last compound matches `el`, earlier ones match ancestors below `scope`. */
function matchChain(el, chain, scope) {
  if (!matchCompound(el, chain[chain.length - 1])) return false;
  let i = chain.length - 2;
  for (let n = el.parent; i >= 0 && n && n !== scope; n = n.parent) {
    if (n instanceof FakeEl && matchCompound(n, chain[i])) i--;
  }
  return i < 0;
}

// ---------- innerHTML ----------

const PROPS = new Set(["id", "lang", "role", "type", "href", "title", "value", "name", "placeholder", "src", "alt", "for", "rows"]);
const BOOL_PROPS = { hidden: "hidden", disabled: "disabled", readonly: "readOnly", checked: "checked" };

function setParsedAttr(el, name, value) {
  const n = name.toLowerCase();
  if (n in BOOL_PROPS) { el[BOOL_PROPS[n]] = true; return; }
  el.setAttribute(n, value);
  if (PROPS.has(n)) el[n === "for" ? "htmlFor" : n] = value;
}

/** A tiny HTML parser for the markup the views write. Returns top-level nodes. */
export function parseHtml(html) {
  const top = new FakeEl("#fragment");
  const stack = [top];
  const cur = () => stack[stack.length - 1];
  const re = /<!--[\s\S]*?-->|<\/([a-zA-Z][\w-]*)\s*>|<([a-zA-Z][\w-]*)((?:\s+[^\s=>\/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>|([^<]+)/g;
  let m;
  while ((m = re.exec(html))) {
    if (m[1]) {
      const tag = m[1].toLowerCase();
      const at = stack.map((n) => n.tag).lastIndexOf(tag);
      if (at > 0) stack.length = at;
    } else if (m[2]) {
      const el = new FakeEl(m[2]);
      const attrRe = /([^\s=>\/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
      let a;
      while ((a = attrRe.exec(m[3] ?? ""))) setParsedAttr(el, a[1], decode(a[2] ?? a[3] ?? a[4] ?? ""));
      cur().append(el);
      if (!m[4] && !VOID.has(el.tag)) stack.push(el);
    } else if (m[5] !== undefined && !m[0].startsWith("<!--")) {
      const text = decode(m[5]);
      if (text) cur().append(text);
    }
  }
  const nodes = [...top.childNodes];
  top._clear();
  return nodes;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function serialize(n) {
  if (n.nodeType === 3) return esc(n.data);
  const attrs = [
    n._class ? ` class="${esc(n._class)}"` : "",
    ...Object.entries(n.attrs).map(([k, v]) => ` ${k}="${esc(v)}"`),
    ...Object.entries(n.dataset).map(([k, v]) => ` data-${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}="${esc(v)}"`),
  ].join("");
  if (VOID.has(n.tag)) return `<${n.tag}${attrs}>`;
  return `<${n.tag}${attrs}>${n.childNodes.map(serialize).join("")}</${n.tag}>`;
}

// ---------- document ----------

export function installFakeDom() {
  const body = new FakeEl("body");
  body.isRoot = true;
  const toasts = new FakeEl("div");
  toasts.id = "toasts";
  body.append(toasts);
  const docHandlers = {};
  globalThis.document = {
    body,
    activeElement: null,
    createElement: (t) => new FakeEl(t),
    createTextNode: (t) => new FakeText(t),
    getElementById: (id) => body.querySelectorAll("*").find((e) => e.id === id) ?? null,
    querySelector: (s) => body.querySelector(s),
    querySelectorAll: (s) => body.querySelectorAll(s),
    addEventListener(type, fn) { (docHandlers[type] ??= []).push(fn); },
    removeEventListener(type, fn) { docHandlers[type] = (docHandlers[type] ?? []).filter((f) => f !== fn); },
    handlers: docHandlers,
  };
  const root = new FakeEl("div");
  root.isRoot = true;
  return root;
}
