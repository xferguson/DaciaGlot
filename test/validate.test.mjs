import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { validateContent, readContentDir, checkPrecache, isValidOp } from "../scripts/validate-content.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");
const CLI = join(HERE, "../scripts/validate-content.mjs");
const run = (dir) => {
  const { raw, fileOf } = readContentDir(dir);
  return validateContent(raw, { fileOf });
};

test("the valid fixture and the real seed content pass with no errors", () => {
  assert.deepEqual(run(join(FIXTURES, "valid")).errors, []);
  assert.deepEqual(run(join(HERE, "../app/content")).errors, []);
});

const invalid = readdirSync(join(FIXTURES, "invalid"));
for (const name of invalid) {
  const rule = Number(name.match(/^r(\d+)-/)[1]);
  test(`fixture ${name} is caught by rule ${rule}`, () => {
    const { errors } = run(join(FIXTURES, "invalid", name));
    assert.ok(errors.some((e) => e.rule === rule), JSON.stringify(errors));
  });
}

test("every rule 1–10 has at least one fixture", () => {
  const covered = new Set(invalid.map((n) => Number(n.match(/^r(\d+)-/)[1])));
  for (let r = 1; r <= 10; r++) assert.ok(covered.has(r), `rule ${r}`);
});

test("CLI exits 0 on valid content and 1 on an invalid fixture, printing file:id: message", () => {
  const ok = spawnSync(process.execPath, [CLI, "--content", join(FIXTURES, "valid")], { encoding: "utf8" });
  assert.equal(ok.status, 0, ok.stderr);
  const bad = spawnSync(process.execPath, [CLI, "--content", join(FIXTURES, "invalid", "r03-join-mismatch")], { encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /sentences\/s\.json:s-1: \[rule 3\]/);
});

test("CLI passes on the real content (rule 11 is skipped without sw.js)", () => {
  const res = spawnSync(process.execPath, [CLI], { encoding: "utf8" });
  assert.equal(res.status, 0, res.stderr);
});

test("warnings: no cloze, missing en on a person transform, unused lexeme", () => {
  const { raw } = readContentDir(join(FIXTURES, "valid"));
  const s = structuredClone(raw.sentences[0]);
  s.tokens.forEach((t) => delete t.cloze);
  s.transforms = [{ op: "person:1sg>3sg", ro: "Ieri a terminat.", targetTokens: [1] }];
  const extra = { id: "unused", lemma: "unused", pos: "adv", gloss: "x", freq: 1 };
  const { errors, warnings } = validateContent({ ...raw, sentences: [s], lexemes: [...raw.lexemes, extra] });
  assert.deepEqual(errors, []);
  const msgs = warnings.map((w) => w.message).join("\n");
  assert.match(msgs, /no cloze/);
  assert.match(msgs, /has no en/);
  assert.match(msgs, /not used by any sentence/);
});

test("the no-transforms warning only applies from phase 2", () => {
  const { raw } = readContentDir(join(FIXTURES, "valid"));
  raw.sentences[0].transforms = [];
  assert.equal(validateContent(raw, { phase: 1 }).warnings.some((w) => /no transforms/.test(w.message)), false);
  assert.equal(validateContent(raw, { phase: 2 }).warnings.some((w) => /no transforms/.test(w.message)), true);
});

test("transform op vocabulary", () => {
  for (const op of ["negate", "person:1sg>3pl", "tense:pres>perf", "add-obj:acc-3sg-m", "add-dat:dat-1sg", "modal:vrea", "plural"]) {
    assert.ok(isValidOp(op), op);
  }
  for (const op of ["person:1sg", "person:1sg>4sg", "tense:pres>past", "add-obj:dat-1sg", "modal:face", "shout", ""]) {
    assert.equal(isValidOp(op), false, op);
  }
});

test("rule 11: precache check is skipped without sw.js and flags missing files", () => {
  const app = mkdtempSync(join(tmpdir(), "dg-app-"));
  mkdirSync(join(app, "js"));
  writeFileSync(join(app, "js/main.js"), "");
  writeFileSync(join(app, "js/other.js"), "");
  assert.equal(checkPrecache(app).skipped, true);
  writeFileSync(join(app, "sw.js"), 'const PRECACHE = ["js/main.js"];');
  const res = checkPrecache(app);
  assert.equal(res.skipped, false);
  assert.deepEqual(res.errors.map((e) => e.id), ["js/other.js"]);
});
