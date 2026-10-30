import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { validateContent, readContentDir, checkPrecache, isValidOp, computeCoverage, coverageReport, strictA1Failures } from "../scripts/validate-content.mjs";

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

test("rule 11: sw.js APP_VERSION must match js/version.js", () => {
  const app = mkdtempSync(join(tmpdir(), "dg-app-"));
  mkdirSync(join(app, "js"));
  writeFileSync(join(app, "js/version.js"), 'export const APP_VERSION = "2.0.0";');
  writeFileSync(join(app, "sw.js"), 'const APP_VERSION = "1.0.0"; const PRECACHE = ["js/version.js"];');
  assert.deepEqual(checkPrecache(app).errors.map((e) => e.id), ["APP_VERSION"]);
  writeFileSync(join(app, "sw.js"), 'const APP_VERSION = "2.0.0"; const PRECACHE = ["js/version.js"];');
  assert.equal(checkPrecache(app).errors.length, 0);
});

// ---- T22: coverage report and --strict-a1 ----

/** Fixture-derived content with `n` copies of the valid sentence, all linked to the A1-x can-do. */
const withCopies = (n) => {
  const { raw } = readContentDir(join(FIXTURES, "valid"));
  const base = raw.sentences[0];
  const sentences = Array.from({ length: n }, (_, i) => ({ ...structuredClone(base), id: `s-${i}`, canDo: ["A1-x"] }));
  return { ...raw, sentences };
};

test("coverage: counts per pattern, situation and can-do, and flags rows below target", () => {
  const raw = withCopies(5);
  const cov = computeCoverage(raw);
  const pat = cov.patterns.find((p) => p.id === "perfect-compus");
  assert.equal(pat.sentences, 5);
  assert.ok(pat.heads >= 1);
  assert.equal(pat.low, true); // 5 < 10 sentences
  assert.equal(cov.canDos.find((c) => c.id === "A1-x").sentences, 5);
  assert.equal(cov.canDos.find((c) => c.id === "A1-x").low, false);
  assert.equal(cov.situations.find((s) => s.id === "standup").sentences, 5);
  assert.equal(cov.situations.find((s) => s.id === "news").low, true);
  const report = coverageReport(raw);
  assert.match(report, /\| ⚠ perfect-compus \|/);
  assert.match(report, /### Can-dos/);
});

test("coverage: lexemes with fewer than 2 sentences are listed", () => {
  const raw = withCopies(1);
  const cov = computeCoverage(raw);
  assert.ok(cov.thinLexemes.length > 0);
  assert.ok(cov.thinLexemes.every((l) => l.sentences < 2));
  assert.equal(computeCoverage(withCopies(2)).thinLexemes.length, 0);
});

test("--strict-a1 flags a can-do with < 5 sentences and patterns below target", () => {
  const msgs = strictA1Failures(withCopies(4));
  assert.ok(msgs.some((m) => /can-do A1-x: 4 sentence/.test(m)), msgs.join("\n"));
  assert.ok(msgs.some((m) => /pattern perfect-compus/.test(m)));
});

test("--strict-a1 passes when every A1 can-do and required pattern meets target", () => {
  const raw = withCopies(12);
  // Give the single required pattern enough distinct head lexemes.
  raw.sentences.forEach((s, i) => {
    for (const tok of s.tokens) for (const u of tok.units) if (u.pattern === "perfect-compus" && u.head) u.lex = `h${i % 6}`;
  });
  assert.deepEqual(strictA1Failures(raw), []);
});

test("CLI: --strict-a1 exits 1 on thin fixture content and --coverage prints Markdown", () => {
  const strict = spawnSync(process.execPath, [CLI, "--content", join(FIXTURES, "valid"), "--strict-a1"], { encoding: "utf8" });
  assert.equal(strict.status, 1);
  assert.match(strict.stderr, /strict-a1/);
  const cov = spawnSync(process.execPath, [CLI, "--content", join(FIXTURES, "valid"), "--coverage"], { encoding: "utf8" });
  assert.equal(cov.status, 0, cov.stderr);
  assert.match(cov.stdout, /## Content coverage/);
});

test("rule 12: lemmaGloss must be one lowercase word, a dotted compound or a small-caps label, ≤ 16 chars", () => {
  const { raw, fileOf } = readContentDir(join(FIXTURES, "valid"));
  const check = (lemmaGloss) => {
    const lexemes = raw.lexemes.map((l, i) => (i === 0 ? { ...l, lemmaGloss } : l));
    return validateContent({ ...raw, lexemes }, { fileOf }).errors.filter((e) => e.rule === 12);
  };
  for (const ok of ["be", "get.up", "NEG", "cabbage.roll"]) assert.deepEqual(check(ok), [], ok);
  for (const bad of ["to be", "Be", "two words", "", "averyveryverylongword", 3]) assert.equal(check(bad).length, 1, String(bad));
});
