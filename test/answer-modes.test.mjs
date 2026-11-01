import { test } from "node:test";
import assert from "node:assert/strict";
import { tileOptions, lexemeForms } from "../app/js/core/cards.js";
import { applyErReview, erMisses } from "../app/js/core/session.js";
import { newCard } from "../app/js/core/fsrs.js";
import { makeContent, state, NOW } from "./helpers/mini-content.mjs";

// Pure helper imported without DOM: answer-mode.js touches the DOM only inside functions.
const { tapDiff, getMode, wordsOf } = await import("../app/js/ui/components/answer-mode.js");

const tok = (t, units, extra = {}) => ({ t, units, ...extra });
const s1 = {
  id: "s1", ro: "Am o problemă.", en: "I have a problem.", level: "A1", stage: 1, situations: ["x"],
  register: "neutral", patterns: ["have-pres"],
  tokens: [
    tok("Am", [{ lex: "avea", form: "pres1sg", pattern: "have-pres", head: true }], { cloze: true }),
    tok("o", [{ lex: "un", form: "f" }]),
    tok("problemă.", [{ lex: "problema", form: "sg" }], { cloze: true }),
  ],
};
const lexemes = [
  { id: "avea", lemma: "a avea", pos: "verb", gloss: "have", forms: { pres1sg: "am", pres2sg: "ai", pres3sg: "are", pres1pl: "avem", pres3pl: "au", neg: "n-am nu" } },
  { id: "un", lemma: "un", pos: "det", gloss: "a", forms: { f: "o", m: "un" } },
  { id: "problema", lemma: "problemă", pos: "noun", gloss: "problem", forms: { sg: "problemă", pl: "probleme", def: "problema" } },
];
const content = makeContent([s1], lexemes, [{ id: "have-pres", slotLabel: "have" }]);
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

test("tileOptions has every target token once per occurrence, lowercased without end punctuation", () => {
  const tiles = tileOptions(s1, content, seq(0.1, 0.9, 0.4));
  for (const w of ["am", "o", "problemă"]) assert.ok(tiles.includes(w), w);
  assert.ok(tiles.length >= 3 + 2 && tiles.length <= 3 + 4);
});

test("tileOptions distractors are only forms of the sentence's lexemes, never targets or multiword", () => {
  const all = new Set(lexemeForms(s1, content));
  for (let k = 0; k < 20; k++) {
    const tiles = tileOptions(s1, content, Math.random);
    const extra = tiles.filter((t) => !["am", "o", "problemă"].includes(t));
    assert.ok(extra.length >= 2 && extra.length <= 4, extra.join());
    for (const e of extra) { assert.ok(all.has(e), e); assert.ok(!/\s/.test(e)); }
    assert.equal(new Set(tiles).size, tiles.length, "no duplicates");
  }
});

test("tileOptions with a transform result uses its words as targets", () => {
  const tiles = tileOptions(s1, content, Math.random, "Nu am o problemă.");
  assert.equal(tiles.filter((t) => t === "nu").length, 1);
  for (const w of ["nu", "am", "o", "problemă"]) assert.ok(tiles.includes(w));
});

test("speak-mode tap diff has the sentence's token count and marks only tapped words", () => {
  const words = wordsOf(s1);
  assert.deepEqual(words, ["Am", "o", "problemă."]);
  assert.deepEqual(tapDiff(words, new Set([2])).map((d) => d.status), ["ok", "ok", "wrong"]);
  assert.deepEqual(tapDiff(words, new Set()).map((d) => d.status), ["ok", "ok", "ok"]);
  assert.equal(getMode({}), "speak");
  assert.equal(getMode({ answerMode: "tiles" }), "tiles");
  assert.equal(getMode({ answerMode: "nonsense" }), "speak");
});

test("a speak-mode tap diff feeds erMisses and reschedules only the tapped units", () => {
  const diff = tapDiff(wordsOf(s1), new Set([2]));
  const m = erMisses(s1, diff);
  assert.deepEqual(m.missed, ["problema.sg"]);
  assert.deepEqual(m.ok, ["avea.pres1sg"]);
  const st = state();
  st.seenSentences.s1 = NOW;
  st.cards["er:s1"] = { ...newCard(NOW), lastReview: NOW - 86400000, due: NOW };
  st.cards["fm:avea:pres1sg"] = { ...newCard(NOW), lastReview: NOW - 86400000 * 5, due: NOW + 86400000 * 5 };
  const units = [{ u: "avea.pres1sg", lx: "avea" }, { u: "problema.sg", lx: "problema" }];
  const out = applyErReview(st, "er:s1", 1, units, m, NOW, content);
  assert.equal(out.cards["fm:avea:pres1sg"].due, st.cards["fm:avea:pres1sg"].due, "untapped form keeps its schedule");
  assert.ok(out.cards["fm:problema:sg"].due <= NOW, "tapped form is due now");
});
