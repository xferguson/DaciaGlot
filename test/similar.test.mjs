import { test } from "node:test";
import assert from "node:assert/strict";
import { sentenceOverlap, similarGroups, similarIndex, SIMILAR_GROUP_CAP } from "../app/js/core/similar.js";
import { cardKeys, burySiblings } from "../app/js/core/due.js";
import { makeContent, sentence } from "./helpers/mini-content.mjs";

const lx = (id, extra = {}) => ({ id, lemma: id, pos: "noun", ...extra });
const u = (lex) => ({ lex, form: lex });
const S = (id, lexes) => sentence(id, lexes.map((l) => l.replace(/^l\./, "w")).join(" "), lexes.map(u));
const lexemes = ["a", "b", "c", "d", "e", "f"].map((n) => lx(n)).concat([lx("the", { trivial: true })]);

test("overlap is the Jaccard of non-trivial lexemes", () => {
  const c = makeContent([S("s1", ["the", "a", "b"]), S("s2", ["the", "a", "c"]), S("s3", ["d", "e"])], lexemes);
  assert.equal(sentenceOverlap("s1", "s2", c), 1 / 3);
  assert.equal(sentenceOverlap("s1", "s1", c), 1);
  assert.equal(sentenceOverlap("s1", "s3", c), 0);
  assert.equal(sentenceOverlap("s1", "nope", c), 0);
});

test("below 0.5 and under 2 lexemes are never similar", () => {
  const c = makeContent([
    S("s1", ["a", "b", "c"]), S("s2", ["a", "d", "e"]), // 1/5
    S("s5", ["f"]), S("s6", ["f", "the"]), // 1 lexeme each, overlap 1
  ], lexemes);
  assert.equal(sentenceOverlap("s5", "s6", c), 1);
  assert.equal(similarGroups(c).size, 0);
});

test("exactly 0.5 counts as similar", () => {
  const c = makeContent([S("x1", ["a", "b"]), S("x2", ["a", "b", "c", "d"])], lexemes);
  assert.equal(sentenceOverlap("x1", "x2", c), 0.5);
  assert.deepEqual(similarGroups(c).get("x1"), ["x1", "x2"]);
});

test("grouping is deterministic, whatever the input order", () => {
  const list = [S("s3", ["a", "b", "c"]), S("s1", ["a", "b"]), S("s2", ["a", "b", "d"])];
  const g1 = similarGroups(makeContent(list, lexemes));
  const g2 = similarGroups(makeContent([...list].reverse(), lexemes));
  assert.deepEqual([...g1], [...g2]);
  assert.deepEqual(g1.get("s1"), ["s1", "s2", "s3"]);
});

test("a hub is split into groups of at most the cap, by id order", () => {
  const many = Array.from({ length: 30 }, (_, i) => lx(`w${i}`));
  const hub = Array.from({ length: 30 }, (_, i) => S(`s${String(i).padStart(2, "0")}`, ["a", "b", `w${i}`]));
  const g = similarGroups(makeContent(hub, lexemes.concat(many)));
  assert.ok([...g.values()].every((m) => m.length <= SIMILAR_GROUP_CAP));
  assert.deepEqual(g.get("s00"), hub.slice(0, 12).map((s) => s.id));
  assert.equal([...g.values()].flat().length, 30);
});

test("indexContent builds similarOf; cardKeys adds g: and burySiblings keeps one", () => {
  const c = makeContent([S("s1", ["a", "b", "c"]), S("s2", ["a", "b", "d"]), S("s3", ["e", "f"])], lexemes);
  assert.deepEqual(c.similarOf.get("s2"), ["s1", "s2"]);
  assert.ok(!c.similarOf.has("s3"));
  assert.ok(cardKeys({ cardId: "lr:s1" }, c).has("g:s1"));
  assert.ok(cardKeys({ cardId: "lr:s2" }, c).has("g:s1"));
  assert.ok(![...cardKeys({ cardId: "lr:s3" }, c)].some((k) => k.startsWith("g:")));
  assert.deepEqual(burySiblings(["lr:s1", "lr:s2", "lr:s3"], c), ["lr:s1", "lr:s3"]);
  assert.deepEqual(similarIndex(similarGroups(c)).get("s1"), ["s1", "s2"]);
});
