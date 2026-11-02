#!/usr/bin/env node
// Zero-dependency lint for app/js (Q16, closed out in Q18). Every rule is enforced with no exceptions.
//
//   node scripts/lint.mjs   # print violations as `file:line rule message`, exit 1 if any
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const SRC = "app/js";

export const RULES = {
  "undeclared-call": "bare call to a name that is never declared or imported in this file",
  "core-purity": "app/js/core is pure: no Math.random, Date.now, document, window, localStorage, navigator",
  "raw-card-id": "raw card-id prefix outside core/cards.js; use the cards.js id helpers",
  "import-direction": "ui/views must not import ui/views; core must import only core",
  "import-cycle": "import is part of a cycle in app/js",
  "import-specifier": "imports must be relative and end in .js",
  "param-reassign": "app/js/core never assigns to a function parameter; use a new local",
  "quote-style": "string literals use double quotes (single quotes only when the text contains a double quote)",
};

// ---------------------------------------------------------------------------------------------
// Stripping. Output has the same length and newlines as the input, so offsets and lines survive.

const REGEX_AFTER_CHAR = new Set("(,=:[!&|?{};+-*%<>~^");
const REGEX_AFTER_WORD = new Set(["return", "typeof", "case", "of", "in", "instanceof", "new", "delete", "void", "throw", "else", "do", "yield", "await"]);
const isWord = (c) => c !== undefined && /[\w$]/.test(c);

/**
 * Blank out comments, string-literal contents, template-literal text (keeping the code inside
 * `${…}`) and regex-literal bodies. With `keepStrings`, only comments are blanked.
 */
export function strip(src, { keepStrings = false } = {}) {
  const out = src.split("");
  const blank = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== "\n") out[k] = " "; };
  const blankText = (from, to) => { if (!keepStrings) blank(from, to); };
  // Each stack entry is the brace depth at which a `${` began; top of stack is the innermost.
  const stack = [];
  let depth = 0;
  let prev = ""; // last significant code character
  let prevIdx = -1;
  let i = 0;
  const n = src.length;

  const regexAllowed = () => {
    if (prev === "") return true;
    if (REGEX_AFTER_CHAR.has(prev)) return true;
    if (isWord(prev)) {
      let s = prevIdx;
      while (s > 0 && isWord(src[s - 1])) s--;
      return REGEX_AFTER_WORD.has(src.slice(s, prevIdx + 1)) && src[s - 1] !== ".";
    }
    return false;
  };

  // Scan template text starting just after a backtick (or after the `}` closing a `${`).
  const template = () => {
    const start = i;
    while (i < n) {
      const c = src[i];
      if (c === "\\") { i += 2; continue; }
      if (c === "`") { blankText(start, i); i++; prev = "`"; prevIdx = i - 1; return; }
      if (c === "$" && src[i + 1] === "{") {
        blankText(start, i);
        i += 2;
        stack.push(depth);
        depth++;
        prev = "{"; prevIdx = i - 1;
        return;
      }
      i++;
    }
    blankText(start, n);
  };

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    if (c === "/" && d === "/") {
      const e = src.indexOf("\n", i);
      const end = e < 0 ? n : e;
      blank(i, end);
      i = end;
      continue;
    }
    if (c === "/" && d === "*") {
      const e = src.indexOf("*/", i + 2);
      const end = e < 0 ? n : e + 2;
      blank(i, end);
      i = end;
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < n && src[j] !== c && src[j] !== "\n") j += src[j] === "\\" ? 2 : 1;
      blankText(i + 1, Math.min(j, n));
      i = j + 1;
      prev = c; prevIdx = j;
      continue;
    }
    if (c === "`") { i++; template(); continue; }
    if (c === "/" && regexAllowed()) {
      let j = i + 1;
      let inClass = false;
      while (j < n && src[j] !== "\n") {
        const r = src[j];
        if (r === "\\") { j += 2; continue; }
        if (inClass) { if (r === "]") inClass = false; }
        else if (r === "[") inClass = true;
        else if (r === "/") break;
        j++;
      }
      if (!keepStrings) blank(i + 1, j);
      j++;
      while (j < n && /[a-z]/i.test(src[j])) j++;
      i = j;
      prev = "/"; prevIdx = j - 1;
      continue;
    }
    if (c === "{") depth++;
    if (c === "}") {
      depth--;
      if (stack.length && stack[stack.length - 1] === depth) { stack.pop(); i++; template(); continue; }
    }
    if (!/\s/.test(c)) { prev = c; prevIdx = i; }
    i++;
  }
  return out.join("");
}

const lineAt = (src, idx) => { let l = 1; for (let k = 0; k < idx; k++) if (src[k] === "\n") l++; return l; };

// ---------------------------------------------------------------------------------------------
// Rule 1 · undeclared bare calls

const KEYWORDS = new Set([
  "if", "for", "while", "switch", "catch", "return", "typeof", "function", "await", "new", "void",
  "delete", "in", "of", "do", "else", "yield", "with", "case", "throw", "async", "import", "super",
  "instanceof", "export", "default", "let", "const", "var", "class", "extends", "this",
]);

export const GLOBALS = new Set([
  // JS
  "Object", "Array", "String", "Number", "Boolean", "Symbol", "BigInt", "Date", "RegExp", "Error",
  "TypeError", "RangeError", "SyntaxError", "ReferenceError", "EvalError", "URIError", "AggregateError",
  "Map", "Set", "WeakMap", "WeakSet", "WeakRef", "Promise", "Proxy", "Function", "ArrayBuffer",
  "DataView", "Int8Array", "Uint8Array", "Uint8ClampedArray", "Int16Array", "Uint16Array",
  "Int32Array", "Uint32Array", "Float32Array", "Float64Array", "BigInt64Array", "BigUint64Array",
  "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent", "decodeURIComponent",
  "encodeURI", "decodeURI", "escape", "unescape", "eval", "structuredClone", "queueMicrotask",
  "setTimeout", "clearTimeout", "setInterval", "clearInterval",
  // Browser
  "requestAnimationFrame", "cancelAnimationFrame", "requestIdleCallback", "cancelIdleCallback",
  "fetch", "alert", "confirm", "prompt", "atob", "btoa", "getComputedStyle", "matchMedia",
  "importScripts", "postMessage", "close", "open", "print", "scrollTo", "addEventListener",
  "removeEventListener", "dispatchEvent", "URL", "URLSearchParams", "Blob", "File", "FileReader",
  "FormData", "Headers", "Request", "Response", "Event", "CustomEvent", "KeyboardEvent", "MouseEvent",
  "EventTarget", "HashChangeEvent", "PopStateEvent", "AbortController", "TextEncoder", "TextDecoder", "MutationObserver",
  "ResizeObserver", "IntersectionObserver", "Image", "Audio", "Option", "Worker",
  "BroadcastChannel", "MessageChannel", "Notification", "SpeechSynthesisUtterance", "DOMParser",
  "XMLSerializer", "DocumentFragment", "Range",
]);

export function undeclaredCalls(code) {
  const declared = new Set();
  for (const m of code.matchAll(/\bfunction\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/g)) declared.add(m[1]);
  const prevNonSpace = (idx) => { let k = idx - 1; while (k >= 0 && /\s/.test(code[k])) k--; return k; };
  const afterDot = (idx) => {
    const k = prevNonSpace(idx);
    return k >= 0 && code[k] === "." && !(code[k - 1] === "." && code[k - 2] === ".");
  };
  const closeParen = (open) => {
    let dp = 0;
    for (let k = open; k < code.length; k++) {
      if (code[k] === "(") dp++;
      else if (code[k] === ")" && --dp === 0) return k;
    }
    return -1;
  };
  // Occurrences of each name that are not property accesses, split into calls and non-calls.
  const occurrences = new Map();
  for (const m of code.matchAll(/[A-Za-z_$][\w$]*/g)) {
    if (isWord(code[m.index - 1])) continue;
    if (/^\d/.test(m[0]) || afterDot(m.index)) continue;
    const rest = code.slice(m.index + m[0].length);
    const call = /^\s*\(/.test(rest);
    const o = occurrences.get(m[0]) ?? { calls: [], other: 0 };
    if (call) o.calls.push(m.index + m[0].length + rest.indexOf("("));
    else o.other++;
    occurrences.set(m[0], o);
  }
  const out = [];
  for (const [name, { calls, other }] of occurrences) {
    if (!calls.length || other || KEYWORDS.has(name) || GLOBALS.has(name) || declared.has(name)) continue;
    for (const open of calls) {
      const close = closeParen(open);
      let k = close + 1;
      while (k < code.length && /\s/.test(code[k])) k++;
      if (close >= 0 && code[k] === "{") continue; // method or class shorthand: name(...) { … }
      out.push({ index: code.lastIndexOf(name, open), message: `${name}() is not declared or imported` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Rule 2 · core purity

const IMPURE = /(?<![\w$.])(?:Math\s*\.\s*random|Date\s*\.\s*now|document|window|localStorage|navigator)(?![\w$])/g;
export function impureUses(code) {
  return [...code.matchAll(IMPURE)].map((m) => ({ index: m.index, message: `${m[0].replace(/\s+/g, "")} in core` }));
}

// ---------------------------------------------------------------------------------------------
// Rule 7 · parameter reassignment in core (a heuristic: scope shadowing is not tracked)

const NOT_NAMES = new Set(["null", "true", "false", "undefined", "NaN", "Infinity"]);

/** Split on top-level commas (not inside brackets). */
function splitTop(text) {
  const parts = [];
  let depth = 0;
  let from = 0;
  for (let k = 0; k < text.length; k++) {
    if ("([{".includes(text[k])) depth++;
    else if (")]}".includes(text[k])) depth--;
    else if (text[k] === "," && depth === 0) { parts.push(text.slice(from, k)); from = k + 1; }
  }
  parts.push(text.slice(from));
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** The names a parameter list binds: plain, defaulted, rest and destructured parameters. */
export function paramNames(list) {
  const names = [];
  for (const p of splitTop(list)) {
    const bare = p.replace(/^\.\.\./, "");
    if (/^[\w$]+/.test(bare) && !/^[{[]/.test(bare)) { names.push(bare.match(/^[\w$]+/)[0]); continue; }
    const pattern = splitTop(bare.replace(/^[{[]|[}\]]\s*(=.*)?$/gs, "")).map((x) => x.replace(/^[\w$]+\s*:/, "").replace(/=.*$/s, "").trim());
    for (const x of pattern) if (/^[\w$]+$/.test(x) && !NOT_NAMES.has(x) && !/^\d/.test(x)) names.push(x);
  }
  return names;
}

const matching = (code, open, o, c) => {
  let d = 0;
  for (let k = open; k < code.length; k++) {
    if (code[k] === o) d++;
    else if (code[k] === c && --d === 0) return k;
  }
  return -1;
};

/** Function bodies with their parameter lists: `function f(a) {…}` and `(a) => {…}` / `a => {…}`. */
function functionsOf(code) {
  const out = [];
  const add = (params, bodyOpen) => {
    const end = matching(code, bodyOpen, "{", "}");
    if (end > 0) out.push({ params: paramNames(params), start: bodyOpen, end });
  };
  for (const m of code.matchAll(/\bfunction\s*\*?\s*[\w$]*\s*\(/g)) {
    const open = m.index + m[0].length - 1;
    const close = matching(code, open, "(", ")");
    const brace = code.indexOf("{", close);
    if (close > 0 && brace > 0) add(code.slice(open + 1, close), brace);
  }
  for (const m of code.matchAll(/=>\s*\{/g)) {
    let k = m.index - 1;
    while (k >= 0 && /\s/.test(code[k])) k--;
    if (code[k] === ")") {
      let d = 0, j = k;
      for (; j >= 0; j--) { if (code[j] === ")") d++; else if (code[j] === "(" && --d === 0) break; }
      add(code.slice(j + 1, k), m.index + m[0].length - 1);
    } else {
      let j = k;
      while (j >= 0 && isWord(code[j])) j--;
      add(code.slice(j + 1, k + 1), m.index + m[0].length - 1);
    }
  }
  return out;
}

export function paramReassignments(code) {
  const out = [];
  for (const { params, start, end } of functionsOf(code)) {
    const body = code.slice(start, end);
    for (const name of params) {
      const re = new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}\\s*(?:\\*\\*|\\?\\?|&&|\\|\\||[-+*/%&|^]|<<|>>>?)?=(?![=>])|(?:\\+\\+|--)${name.replace(/\$/g, "\\$")}(?![\\w$])|(?<![\\w$.])${name.replace(/\$/g, "\\$")}(?:\\+\\+|--)`, "g");
      for (const m of body.matchAll(re)) out.push({ index: start + m.index, message: `parameter ${name} is reassigned` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Rule 8 · quote style

/** Single-quoted string literals whose text has no double quote; `text` keeps strings, `code` blanks them. */
export function singleQuoted(text, code) {
  const out = [];
  const marks = [];
  for (let i = 0; i < code.length; i++) if (code[i] === "'") marks.push(i);
  for (let p = 0; p + 1 < marks.length; p += 2) {
    if (!text.slice(marks[p] + 1, marks[p + 1]).includes('"')) out.push({ index: marks[p], message: "single-quoted string; use double quotes" });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Rule 3 · raw card-id prefixes (needs string contents, so it runs on comment-stripped source)

export const CARD_PREFIXES = ["lr", "cz", "kf", "fm", "xf", "sb", "er", "pg"];
const P = CARD_PREFIXES.join("|");
const RAW_ID = [
  [new RegExp(`\\.startsWith\\(\\s*(["'\`])(?:${P}):\\1`, "g"), "startsWith on a card-id prefix"],
  [new RegExp(`\`(?:${P}):\\$\\{`, "g"), "card id built from a template literal"],
  [new RegExp(`(["'])(?:${P}):\\1\\s*\\+`, "g"), "card id built by concatenation"],
  [/\.slice\(\s*3\s*\)/g, ".slice(3) strips a card-id prefix"],
];
export function rawCardIds(text) {
  return RAW_ID.flatMap(([re, message]) => [...text.matchAll(re)].map((m) => ({ index: m.index, message })));
}

// ---------------------------------------------------------------------------------------------
// Imports (rules 4–6)

/** Static and dynamic import specifiers with their offsets, from comment-stripped source. */
export function importsOf(text) {
  const out = [];
  const re = /(?<![\w$.])(?:import|export)\s*(?:[\w$*{}\s,]*?\bfrom\s*)?(["'])([^"'\n]+)\1|(?<![\w$.])import\s*\(\s*(["'])([^"'\n]+)\3\s*\)/g;
  for (const m of text.matchAll(re)) {
    const dynamic = m[4] !== undefined;
    out.push({ index: m.index, spec: dynamic ? m[4] : m[2], dynamic });
  }
  return out;
}

const isRelative = (spec) => spec.startsWith("./") || spec.startsWith("../");

export function badSpecifiers(imports) {
  return imports.filter((im) => !isRelative(im.spec) || !im.spec.endsWith(".js"))
    .map((im) => ({ index: im.index, message: `"${im.spec}" is not a relative .js path` }));
}

const resolveSpec = (file, spec) => posix.normalize(posix.join(posix.dirname(file), spec));

export function wrongDirection(file, imports) {
  const out = [];
  const inView = file.startsWith(`${SRC}/ui/views/`);
  const inCore = file.startsWith(`${SRC}/core/`);
  for (const im of imports) {
    if (!isRelative(im.spec)) continue;
    const target = resolveSpec(file, im.spec);
    if (inView && target.startsWith(`${SRC}/ui/views/`)) out.push({ index: im.index, message: `view imports view ${target.slice(SRC.length + 1)}` });
    if (inCore && !target.startsWith(`${SRC}/core/`)) out.push({ index: im.index, message: `core imports ${target.slice(SRC.length + 1)}` });
  }
  return out;
}

/** Static import edges that lie on a cycle: [{file, index, message}]. `graph`: file → [{target, index}]. */
export function cycleEdges(graph) {
  // Tarjan's strongly connected components.
  let counter = 0;
  const idx = new Map(), low = new Map(), comp = new Map(), stack = [], on = new Set();
  const visit = (v) => {
    idx.set(v, counter); low.set(v, counter); counter++;
    stack.push(v); on.add(v);
    for (const { target: w } of graph.get(v) ?? []) {
      if (!graph.has(w)) continue;
      if (!idx.has(w)) { visit(w); low.set(v, Math.min(low.get(v), low.get(w))); }
      else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      let w;
      do { w = stack.pop(); on.delete(w); comp.set(w, v); } while (w !== v);
    }
  };
  for (const v of [...graph.keys()].sort()) if (!idx.has(v)) visit(v);
  const pathBack = (from, to) => { // BFS inside the component, from → … → to
    const prevOf = new Map([[from, null]]);
    const q = [from];
    while (q.length) {
      const v = q.shift();
      if (v === to) break;
      for (const { target: w } of graph.get(v) ?? []) {
        if (comp.get(w) === comp.get(from) && !prevOf.has(w)) { prevOf.set(w, v); q.push(w); }
      }
    }
    const path = [];
    for (let v = to; v !== null; v = prevOf.get(v)) path.unshift(v);
    return path;
  };
  const short = (f) => f.slice(SRC.length + 1);
  const out = [];
  for (const [v, edges] of graph) {
    for (const { target: w, index } of edges) {
      if (!graph.has(w) || comp.get(v) !== comp.get(w)) continue;
      const cycle = [v, ...(v === w ? [v] : pathBack(w, v))];
      out.push({ file: v, index, message: `cycle ${cycle.map(short).join(" → ")}` });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Driver

/** Lint in-memory files: [{file (repo-relative, posix), src}] → [{file, line, rule, message}]. */
export function lintSources(sources) {
  const out = [];
  const graph = new Map();
  const srcOf = new Map();
  const push = (file, rule, hits) => { for (const h of hits) out.push({ file, line: lineAt(srcOf.get(file), h.index), rule, message: h.message }); };
  for (const { file, src } of sources) {
    srcOf.set(file, src);
    const code = strip(src);
    const text = strip(src, { keepStrings: true });
    const imports = importsOf(text);
    push(file, "undeclared-call", undeclaredCalls(code));
    if (file.startsWith(`${SRC}/core/`)) push(file, "core-purity", impureUses(code));
    if (file.startsWith(`${SRC}/core/`)) push(file, "param-reassign", paramReassignments(code));
    if (file !== `${SRC}/core/cards.js`) push(file, "raw-card-id", rawCardIds(text));
    push(file, "quote-style", singleQuoted(text, code));
    push(file, "import-direction", wrongDirection(file, imports));
    push(file, "import-specifier", badSpecifiers(imports));
    graph.set(file, imports.filter((im) => !im.dynamic && isRelative(im.spec)).map((im) => ({ target: resolveSpec(file, im.spec), index: im.index })));
  }
  for (const e of cycleEdges(graph)) push(e.file, "import-cycle", [e]);
  return out.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
}

export function sourceFiles(root = ROOT, dir = SRC) {
  return readdirSync(join(root, dir)).sort().flatMap((f) => {
    const rel = `${dir}/${f}`;
    return statSync(join(root, rel)).isDirectory() ? sourceFiles(root, rel) : rel.endsWith(".js") ? [rel] : [];
  });
}

export const lintRepo = (root = ROOT) => lintSources(sourceFiles(root).map((file) => ({ file, src: readFileSync(join(root, file), "utf8") })));

export const format = (v) => `${v.file}:${v.line} ${v.rule} ${v.message}`;

function main() {
  const violations = lintRepo();
  for (const v of violations) console.log(format(v));
  if (violations.length) {
    console.log(`\n${violations.length} lint violation(s).`);
    process.exitCode = 1;
  } else {
    console.log("Lint OK.");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
