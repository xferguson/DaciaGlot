// Guards against a function used in one module but never imported there. A missing import is not
// caught at load time in ES modules; it throws only when the line runs (session.js once lost its
// pace imports in a merge, so finishing or leaving a session did nothing).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("../app/js/", import.meta.url).pathname;
const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith(".js") ? [p] : [];
});

const strip = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:"'`])\/\/.*$/gm, "$1")
  .replace(/`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/g, '""');

test("every exported function called in a module is imported or declared there", () => {
  const all = files(ROOT);
  const exported = new Set();
  for (const f of all) {
    for (const m of readFileSync(f, "utf8").matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z_$][\w$]*)/g)) exported.add(m[1]);
  }
  const problems = [];
  for (const f of all) {
    const raw = readFileSync(f, "utf8");
    const imports = [...raw.matchAll(/import\s*\{([^}]*)\}\s*from/g)]
      .flatMap((m) => m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()));
    const src = strip(raw);
    for (const name of exported) {
      if (!new RegExp(`(?<![\\w$.])${name.replace(/\$/g, "\\$")}\\s*\\(`).test(src)) continue;
      if (imports.includes(name)) continue;
      const declared = new RegExp(`(?:function\\*?|const|let|var|class)\\s+${name}\\b|[{,(]\\s*${name}\\s*[,})=:]`).test(src);
      if (!declared) problems.push(`${f.slice(ROOT.length)}: ${name}`);
    }
  }
  assert.deepEqual(problems, []);
});
