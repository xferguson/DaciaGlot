import { test } from "node:test";
import assert from "node:assert/strict";
import { unitsForSentence, unitsRequiredForCard, isKnown } from "../app/js/core/units.js";
import { makeContent, state, NOW } from "./helpers/mini-content.mjs";

const s = {
  id: "s1", ro: "am terminat", en: "", level: "A1", stage: 1, situations: [], register: "neutral",
  patterns: ["perf"],
  tokens: [
    { t: "am", units: [{ lex: "aux", form: "1sg", pattern: "perf" }] },
    { t: "terminat", units: [{ lex: "termina", form: "ppl", pattern: "perf", head: true }], cloze: true },
  ],
};
const s2 = { ...s, id: "s2", tokens: [s.tokens[0], { t: "gasit", units: [{ lex: "termina", form: "inf" }], cloze: true }] };
const lexemes = [{ id: "aux", trivial: true }, { id: "termina" }];
const content = makeContent([s, s2], lexemes, [{ id: "perf" }]);

test("unitsForSentence", () => {
  assert.deepEqual(unitsForSentence(s).sort(), ["aux.1sg", "pat:perf", "termina.ppl"]);
});

test("unitsRequiredForCard: cz token units plus their patterns; lr none", () => {
  assert.deepEqual(unitsRequiredForCard("cz:s1:1", content), [
    { u: "termina.ppl", lx: "termina" }, { u: "pat:perf", lx: "termina" },
  ]);
  assert.deepEqual(unitsRequiredForCard("lr:s1", content), []);
});

test("isKnown: correct attempt, aggregate", () => {
  const st = state();
  assert.equal(isKnown("termina.ppl", st, content), false);
  st.attempts.push({ u: "termina.ppl", lx: "termina", c: 0, t: NOW, card: "x" });
  assert.equal(isKnown("termina.ppl", st, content), false);
  st.attempts.push({ u: "termina.ppl", lx: "termina", c: 1, t: NOW, card: "x" });
  assert.equal(isKnown("termina.ppl", st, content), true);
  st.unitAggregates["aux.1sg"] = { n: 3, correct: 2, lexemes: [], lastCorrectAt: NOW };
  assert.equal(isKnown("aux.1sg", st, content), true);
});

test("isKnown: trivial lexeme known once seen", () => {
  const st = state();
  assert.equal(isKnown("aux.1sg", st, content), false);
  st.seenSentences.s1 = NOW;
  assert.equal(isKnown("aux.1sg", st, content), true);
});

test("isKnown: pattern known once a sentence with it is seen", () => {
  const st = state();
  assert.equal(isKnown("pat:perf", st, content), false);
  st.seenSentences.s2 = NOW;
  assert.equal(isKnown("pat:perf", st, content), true);
});

test("isKnown: new form seen in a recognized sentence of a known lexeme", () => {
  const st = state();
  st.seenSentences.s2 = NOW;
  assert.equal(isKnown("termina.inf", st, content), false); // no other form known yet
  st.attempts.push({ u: "termina.ppl", lx: "termina", c: 1, t: NOW, card: "x" });
  assert.equal(isKnown("termina.inf", st, content), true);
  assert.equal(isKnown("termina.ppl", { ...st, attempts: [] }, content), false);
});
