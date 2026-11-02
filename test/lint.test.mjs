// Q16: the zero-dependency lint (scripts/lint.mjs) and its ratcheting allowlist.
// Replaces test/imports.test.mjs: rule 1 (undeclared bare calls) catches a function used in a
// module but never imported there, including calls inside `${…}`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  ALLOW_PATH, checkAllow, format, lintRepo, lintSources, shrinkAllow, sourceFiles, strip,
} from "../scripts/lint.mjs";

const lint = (files) => lintSources(Object.entries(files).map(([file, src]) => ({ file, src })));
const rules = (files) => lint(files).map((v) => v.rule);

test("strip blanks comments, strings, template text and regexes but keeps ${} code and offsets", () => {
  const src = 'a("x(") // b()\n/* c() */ `t d() ${e("f")} g()` + /h()/.test(s) / 2';
  const out = strip(src);
  assert.equal(out.length, src.length);
  assert.equal(out.split("\n").length, 2);
  for (const gone of ["x(", "b()", "c()", "d()", "g()", "h()", '"f"']) assert.ok(!out.includes(gone), gone);
  assert.match(out, /a\(" *"\)/);
  assert.match(out, /\$\{e\(" "\)\}/);
  assert.match(out, /\.test\(s\) \/ 2/); // division after `)` is not a regex
});

test("strip handles nested templates and regex after keywords", () => {
  const out = strip("const s = `a ${b ? `c ${d()}` : 'e'} f`; return /x()/g;");
  assert.match(out, /\$\{b \? ` *\$\{d\(\)\}` : ' '\}/);
  assert.ok(!out.includes("x()"));
});

test("rule undeclared-call: flags a call never declared or imported, also inside ${}", () => {
  assert.deepEqual(rules({ "app/js/a.js": "export const f = () => `n: ${count(1)}`;\n" }), ["undeclared-call"]);
  assert.deepEqual(rules({ "app/js/a.js": "export const f = () => paceOf();\n" }), ["undeclared-call"]);
  const ok = [
    'import { count } from "./b.js";\nexport const f = () => `n: ${count(1)}`;',
    "function count() {}\nexport const f = () => count();",
    "const o = { count(x) { return x; } };\nexport const f = (count) => count();",
    "export class A { run() { return 1; } }",
    "export const f = () => Math.max(1, parseInt('2')) + o.count() + new Map().size;",
    "// count()\nexport const s = 'count()' + `count()` + /count()/.source;",
  ];
  for (const src of ok) assert.deepEqual(rules({ "app/js/a.js": src }), [], src);
});

test("rule core-purity: Math.random, Date.now and browser globals are banned in core only", () => {
  for (const bad of ["Math.random()", "Date.now()", "document.body", "window.x", "localStorage.getItem('k')", "navigator.language"]) {
    assert.deepEqual(rules({ "app/js/core/x.js": `export const f = () => ${bad};` }), ["core-purity"], bad);
  }
  assert.deepEqual(rules({ "app/js/core/x.js": "export const f = (rng, now, o) => rng() + now + o.window + o.document;" }), []);
  assert.deepEqual(rules({ "app/js/ui/x.js": "export const f = () => Math.random() + Date.now() + document.title;" }), []);
});

test("rule raw-card-id: card-id prefixes are built and parsed only in core/cards.js", () => {
  for (const bad of ['id.startsWith("fm:")', "`lr:${sid}`", "id.slice(3)", '"er:" + sid']) {
    assert.deepEqual(rules({ "app/js/ui/x.js": `export const f = (id, sid) => ${bad};` }), ["raw-card-id"], bad);
  }
  assert.deepEqual(rules({ "app/js/core/cards.js": 'export const f = (id) => id.startsWith("fm:") && `lr:${id}`;' }), []);
  assert.deepEqual(rules({ "app/js/ui/x.js": 'export const f = (u) => u.startsWith("pat:") && u.slice(4);' }), []);
});

test("rule import-direction: views never import views; core imports only core", () => {
  assert.deepEqual(rules({ "app/js/ui/views/a.js": 'import { x } from "./b.js";' }), ["import-direction"]);
  assert.deepEqual(rules({ "app/js/core/a.js": 'import { x } from "../data/store.js";' }), ["import-direction"]);
  assert.deepEqual(rules({
    "app/js/ui/views/a.js": 'import { x } from "../components/b.js";\nimport { y } from "../../core/c.js";',
    "app/js/core/a.js": 'import { x } from "./b.js";',
  }), []);
});

test("rule import-cycle: every static import on a cycle is reported", () => {
  const cyc = lint({
    "app/js/core/a.js": 'import { b } from "./b.js";',
    "app/js/core/b.js": 'import { c } from "./c.js";',
    "app/js/core/c.js": 'import { a } from "./a.js";',
  });
  assert.deepEqual(cyc.map((v) => v.rule), ["import-cycle", "import-cycle", "import-cycle"]);
  assert.match(cyc[0].message, /core\/a\.js → core\/b\.js → core\/c\.js → core\/a\.js/);
  assert.deepEqual(rules({
    "app/js/core/a.js": 'import { b } from "./b.js";',
    "app/js/core/b.js": 'export const b = () => import("./a.js");', // dynamic imports don't count
  }), []);
});

test("rule import-specifier: imports are relative and end in .js", () => {
  for (const bad of ['import { x } from "./b";', 'import x from "/js/b.js";', 'export { x } from "lib";', 'const m = import("pkg");']) {
    assert.deepEqual(rules({ "app/js/a.js": bad }), ["import-specifier"], bad);
  }
  assert.deepEqual(rules({ "app/js/a.js": 'import { x } from "./b.js";\nimport "../c.js";\nexport * from "./d.js";\nconst m = () => import("./e.js");' }), []);
});

test("violations print as `file:line rule message`", () => {
  const [v] = lint({ "app/js/core/x.js": "\n\nexport const f = () => Date.now();" });
  assert.equal(format(v), "app/js/core/x.js:3 core-purity Date.now in core");
});

const allow = JSON.parse(readFileSync(ALLOW_PATH, "utf8"));
const repo = () => sourceFiles().map((file) => ({ file, src: readFileSync(new URL(`../${file}`, import.meta.url), "utf8") }));

test("app/js matches the allowlist exactly (no new violations, no stale entries)", () => {
  const { over, stale } = checkAllow(lintRepo(), allow);
  assert.deepEqual(over.map(format), [], "new lint violations");
  assert.deepEqual(stale, [], "allowlist can shrink: run node scripts/lint.mjs --update-allow");
});

test("adding Math.random() to a core file fails the lint", () => {
  const files = repo().map((f) => f.file === "app/js/core/fsrs.js" ? { ...f, src: `${f.src}\nexport const r = () => Math.random();\n` } : f);
  const { over } = checkAllow(lintSources(files), allow);
  assert.deepEqual(over.map((v) => `${v.file} ${v.rule}`), ["app/js/core/fsrs.js core-purity"]);
});

test("a new view-to-view import fails the lint", () => {
  const files = repo().map((f) => f.file === "app/js/ui/views/lexeme.js" ? { ...f, src: `import { listRows } from "./lists.js";\n${f.src}` } : f);
  const { over } = checkAllow(lintSources(files), allow);
  assert.deepEqual(over.map((v) => `${v.file}:${v.line} ${v.rule}`), ["app/js/ui/views/lexeme.js:1 import-direction"]);
});

test("shrinkAllow only lowers or removes entries, never adds or raises them", () => {
  const violations = [
    { file: "a.js", rule: "core-purity" }, { file: "a.js", rule: "core-purity" }, { file: "a.js", rule: "core-purity" },
    { file: "b.js", rule: "raw-card-id" },
    { file: "c.js", rule: "import-cycle" },
  ];
  const next = shrinkAllow({ "core-purity": { "a.js": 2, "z.js": 4 }, "raw-card-id": { "b.js": 5 } }, violations);
  assert.deepEqual(next["core-purity"], { "a.js": 2 });
  assert.deepEqual(next["raw-card-id"], { "b.js": 1 });
  assert.deepEqual(next["import-cycle"], {});
});
