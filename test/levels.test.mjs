import { test } from "node:test";
import assert from "node:assert/strict";
import { levelProgress, canDoCheckable, canDoMastery } from "../app/js/core/mastery.js";
import { indexContent } from "../app/js/data/content.js";
import { NOW, sentence, state as freshState } from "./helpers/mini-content.mjs";

const DAY = 86400000;
const U = (lex, form = "x") => ({ lex, form });
const s1 = sentence("s1", "aa bb", [{ ...U("a"), pattern: "p" }, U("b")], { patterns: ["p"], canDo: ["c1"] });
const s2 = sentence("s2", "cc dd", [{ ...U("c"), pattern: "q" }, U("d")], { patterns: ["q"], canDo: ["c1", "c2"] });
const s3 = sentence("s3", "ee ff", [U("e"), U("f")], { canDo: ["c3"] });
const level = {
  id: "A1",
  requiredPatterns: ["p", "q"],
  targetLexemes: ["a", "b", "c", "d", "e"],
  canDos: [{ id: "c1", situation: "x", text: "one" }, { id: "c2", situation: "x", text: "two" }, { id: "c3", situation: "x", text: "three" }, { id: "c4", situation: "x", text: "empty" }],
};
const patterns = [{ id: "p", stage: 1, level: "A1", minLexemesForProducing: 1 }, { id: "q", stage: 1, level: "A1", minLexemesForProducing: 1 }];
const content = indexContent({ manifest: { contentVersion: "t" }, patterns, lexemes: ["a", "b", "c", "d", "e", "f"].map((id) => ({ id, lemma: id, freq: 10 })), sentences: [s1, s2, s3], levels: [level] });

const card = (stability, extra = {}) => ({ due: NOW, stability, difficulty: 5, reps: 3, lapses: 0, state: 2, step: 0, lastReview: NOW - DAY, ...extra });
const att = (u, lx, c = 1) => ({ u, lx, c, t: NOW - DAY, card: "cz:s1:0" });
const st = (extra = {}) => ({ ...freshState(), ...extra });

test("canDoCheckable: needs linked sentences, all mastered", () => {
  const one = { "cz:s1:0": card(7) };
  const both = { ...one, "cz:s2:0": card(8) };
  assert.equal(canDoCheckable("c4", st({ cards: both }), content, NOW), false, "no linked sentences");
  assert.equal(canDoCheckable("c1", st(), content, NOW), false);
  assert.equal(canDoCheckable("c1", st({ cards: one }), content, NOW), false, "only one of two");
  assert.equal(canDoCheckable("c1", st({ cards: both }), content, NOW), true);
  assert.equal(canDoCheckable("c1", st({ cards: { ...both, "cz:s2:0": card(6.9) } }), content, NOW), false, "stability below 7");
  assert.deepEqual(canDoMastery("c1", st({ cards: one }), content, NOW), { done: 1, total: 2 });
});

test("levelProgress: empty state is zero and incomplete", () => {
  const p = levelProgress("A1", st(), content, NOW);
  assert.deepEqual(p, { patterns: { done: 0, total: 2 }, canDos: { done: 0, total: 4 }, lexemes: { done: 0, total: 5 }, complete: false, percent: 0 });
});

test("levelProgress: counts patterns at producing, checked can-dos and produced lexemes", () => {
  const attempts = [att("pat:p", "a"), att("a.x", "a"), att("b.x", "b", 0)];
  const seenSentences = { s1: NOW - DAY };
  const p = levelProgress("A1", st({ attempts, seenSentences, canDoChecked: { c1: NOW } }), content, NOW);
  assert.deepEqual(p.patterns, { done: 1, total: 2 });
  assert.deepEqual(p.canDos, { done: 1, total: 4 });
  assert.deepEqual(p.lexemes, { done: 1, total: 5 }, "wrong attempt on b is not produced");
  assert.ok(Math.abs(p.percent - ((0.5 + 0.25 + 0.2) / 3) * 100) < 1e-9);
  assert.equal(p.complete, false);
});

test("levelProgress: complete needs all patterns and 80% of can-dos and lexemes", () => {
  const seenSentences = { s1: NOW - DAY, s2: NOW - DAY };
  const attempts = [
    ...["a", "b", "c", "d", "e"].map((l) => att(`${l}.x`, l)),
    att("pat:p", "a"), att("pat:q", "c"),
  ];
  const base = { attempts, seenSentences };
  const checked = (ids) => Object.fromEntries(ids.map((i) => [i, NOW]));
  assert.equal(levelProgress("A1", st({ ...base, canDoChecked: checked(["c1", "c2", "c3"]) }), content, NOW).complete, false, "3/4 = 75%");
  const full = levelProgress("A1", st({ ...base, canDoChecked: checked(["c1", "c2", "c3", "c4"]) }), content, NOW);
  assert.equal(full.complete, true);
  assert.equal(full.percent, 100);
  // 4 of 5 lexemes = 80% is enough
  const four = levelProgress("A1", st({ ...base, attempts: attempts.filter((a) => a.u !== "e.x"), canDoChecked: checked(["c1", "c2", "c3", "c4"]) }), content, NOW);
  assert.equal(four.lexemes.done, 4);
  assert.equal(four.complete, true);
  // one required pattern short
  const short = levelProgress("A1", st({ ...base, attempts: attempts.filter((a) => a.u !== "pat:q"), canDoChecked: checked(["c1", "c2", "c3", "c4"]) }), content, NOW);
  assert.equal(short.complete, false);
});

test("levelProgress: unknown level throws", () => {
  assert.throws(() => levelProgress("Z9", st(), content, NOW));
});
