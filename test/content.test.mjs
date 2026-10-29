import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { indexContent, loadContent, packPaths } from "../app/js/data/content.js";
import { readContentDir } from "../scripts/validate-content.mjs";

const CONTENT = join(dirname(fileURLToPath(import.meta.url)), "../app/content");
const { raw } = readContentDir(CONTENT);

test("indexContent builds every Map from the seed content", () => {
  const c = indexContent(raw);
  assert.equal(c.contentVersion, raw.manifest.contentVersion);
  assert.equal(c.sentences.size, 100);
  assert.equal(c.patterns.size, 18);
  assert.ok(c.lexemes.has("aux-perf") && c.lexemes.has("nu"));
  assert.ok(c.levels.has("A1"));
});

test("indexes by pattern, situation and lexeme", () => {
  const c = indexContent(raw);
  assert.deepEqual(
    ["standup", "me", "meta", "table"].map((s) => c.sentencesBySituation.get(s).length),
    [30, 30, 20, 20],
  );
  assert.ok(c.sentencesByPattern.get("perfect-compus").includes("s-a1-standup-0003"));
  // the n-am cluster contributes both of its units
  assert.ok(c.sentencesByLexeme.get("nu").includes("s-a1-standup-0003"));
  assert.ok(c.sentencesByLexeme.get("aux-perf").includes("s-a1-standup-0003"));
});

test("content has a clitic cluster and a transform on at least 60% of sentences", () => {
  const sentences = [...indexContent(raw).sentences.values()];
  assert.ok(sentences.some((s) => s.tokens.some((t) => t.units.length > 1 && /^n-am/i.test(t.t))));
  const withTransforms = sentences.filter((s) => (s.transforms ?? []).length >= 1).length;
  assert.ok(withTransforms / sentences.length >= 0.6);
});

test("retired sentences are dropped from every index", () => {
  const retired = { ...raw.sentences[0], id: "s-retired", retired: true };
  const c = indexContent({ ...raw, sentences: [...raw.sentences, retired] });
  assert.equal(c.sentences.has("s-retired"), false);
  for (const map of [c.sentencesByPattern, c.sentencesBySituation, c.sentencesByLexeme]) {
    for (const ids of map.values()) assert.equal(ids.includes("s-retired"), false);
  }
});

test("loadContent fetches the manifest then every pack", async () => {
  const requested = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    requested.push(url);
    const rel = url.replace("./content/", "");
    try {
      const body = readFileSync(join(CONTENT, rel), "utf8");
      return { ok: true, status: 200, json: async () => JSON.parse(body) };
    } catch {
      return { ok: false, status: 404, json: async () => ({}) };
    }
  };
  try {
    const c = await loadContent();
    assert.equal(requested[0], "./content/manifest.json");
    assert.equal(requested.length, 1 + 1 + 1 + 4 + 1); // manifest, patterns, lexemes, 4 sentence packs, levels
    assert.equal(c.sentences.size, 100);
  } finally {
    globalThis.fetch = realFetch;
  }
});

test("packPaths resolves level ids to files", () => {
  assert.deepEqual(packPaths({ levels: ["A1"] }).levels, ["levels/A1.json"]);
});
