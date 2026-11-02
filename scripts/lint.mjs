#!/usr/bin/env node
// Zero-dependency lint for app/js with ratcheting allowlists (Q16).
//
//   node scripts/lint.mjs                 # print new violations as `file:line rule message`, exit 1 if any
//   node scripts/lint.mjs --all           # print every violation, allowlisted or not
//   node scripts/lint.mjs --update-allow  # shrink scripts/lint-allow.json to today's counts (never grows)
//
// The allowlist maps rule → file → count. A file may have at most its allowed count of violations
// for a rule; more fails, and fewer also fails (the entry is stale, so the ratchet must click down
// with --update-allow). New entries are never added by --update-allow: fix the code instead.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, posix, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = fileURLToPath(new URL("../", import.meta.url));
export const SRC = "app/js";
export const ALLOW_PATH = join(ROOT, "scripts/lint-allow.json");

export const RULES = {
  "undeclared-call": "bare call to a name that is never declared or imported in this file",
  "core-purity": "app/js/core is pure: no Math.random, Date.now, document, window, localStorage, navigator",
  "raw-card-id": "raw card-id prefix outside core/cards.js; use the cards.js id helpers",
  "import-direction": "ui/views must not import ui/views; core must import only core",
  "import-cycle": "import is part of a cycle in app/js",
  "import-specifier": "imports must be relative and end in .js",
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
    if (file !== `${SRC}/core/cards.js`) push(file, "raw-card-id", rawCardIds(text));
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

/** Count violations as {rule: {file: n}}. */
export function countViolations(violations) {
  const counts = {};
  for (const v of violations) (counts[v.rule] ??= {})[v.file] = (counts[v.rule][v.file] ?? 0) + 1;
  return counts;
}

/**
 * Compare violations with an allowlist. `over` lists violations in rule/file pairs above their
 * allowed count; `stale` lists allowlist entries above today's count ({rule, file, allowed, actual}).
 */
export function checkAllow(violations, allow) {
  const counts = countViolations(violations);
  const over = violations.filter((v) => counts[v.rule][v.file] > (allow[v.rule]?.[v.file] ?? 0));
  const stale = [];
  for (const [rule, files] of Object.entries(allow)) {
    for (const [file, allowed] of Object.entries(files)) {
      const actual = counts[rule]?.[file] ?? 0;
      if (actual < allowed) stale.push({ rule, file, allowed, actual });
    }
  }
  return { over, stale };
}

/** The allowlist shrunk to today's counts: entries only go down or disappear, never appear or grow. */
export function shrinkAllow(allow, violations) {
  const counts = countViolations(violations);
  const next = {};
  for (const rule of Object.keys(RULES)) {
    next[rule] = {};
    for (const [file, allowed] of Object.entries(allow[rule] ?? {}).sort(([a], [b]) => a.localeCompare(b))) {
      const n = Math.min(allowed, counts[rule]?.[file] ?? 0);
      if (n > 0) next[rule][file] = n;
    }
  }
  return next;
}

export const format = (v) => `${v.file}:${v.line} ${v.rule} ${v.message}`;

function main(args) {
  const violations = lintRepo();
  const allow = JSON.parse(readFileSync(ALLOW_PATH, "utf8"));
  if (args.includes("--update-allow")) {
    const next = shrinkAllow(allow, violations);
    writeFileSync(ALLOW_PATH, `${JSON.stringify(next, null, 2)}\n`);
    console.log(`Wrote ${relative(ROOT, ALLOW_PATH)}.`);
  }
  const { over, stale } = checkAllow(violations, args.includes("--update-allow") ? shrinkAllow(allow, violations) : allow);
  const shown = args.includes("--all") ? violations : over;
  for (const v of shown) console.log(format(v));
  for (const s of stale) console.log(`${s.file} ${s.rule} allowlist says ${s.allowed}, found ${s.actual}: run node scripts/lint.mjs --update-allow`);
  if (over.length || stale.length) {
    if (over.length) console.log(`\n${over.length} lint violation(s) beyond the allowlist. Fix them; the allowlist never grows.`);
    process.exitCode = 1;
  } else {
    console.log(`Lint OK (${violations.length} allowlisted violation(s) left).`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main(process.argv.slice(2));
