import { test } from "node:test";
import assert from "node:assert/strict";
import { isUnlocked, erUnlocked, erUnits, newErCards, pickPerSentence, buildCardId } from "../app/js/core/cards.js";
import { unitsRequiredForCard } from "../app/js/core/units.js";
import { buildSession } from "../app/js/core/session.js";
import { newCard } from "../app/js/core/fsrs.js";
import { makeContent, state, NOW } from "./helpers/mini-content.mjs";

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
const noCloze = {
  id: "s2", ro: "Bună.", en: "Hi.", level: "A1", stage: 1, situations: ["x"], register: "neutral", patterns: [],
  tokens: [tok("Bună.", [{ lex: "buna", form: "base" }])],
};
const lexemes = [
  { id: "avea", lemma: "a avea", pos: "verb", gloss: "have", forms: { pres1sg: "am" } },
  { id: "un", lemma: "un", pos: "det", gloss: "a", forms: { f: "o" } },
  { id: "problema", lemma: "problemă", pos: "noun", gloss: "problem", forms: { sg: "problemă" } },
  { id: "buna", lemma: "bună", pos: "adj", gloss: "hi", forms: { base: "bună" } },
];
const content = makeContent([s1, noCloze], lexemes, [{ id: "have-pres", slotLabel: "have" }]);

function withCz(stabs) {
  const st = state();
  st.seenSentences.s1 = NOW;
  stabs.forEach((stability, i) => {
    st.cards[i === 0 ? "fm:avea:pres1sg" : "fm:problema:sg"] = { ...newCard(NOW), stability };
  });
  return st;
}

test("er unlocks only when every cloze unit's fm card has stability ≥ 7 days", () => {
  assert.equal(erUnlocked(s1, withCz([7, 7])), true);
  assert.equal(erUnlocked(s1, withCz([30, 6.9])), false);
  assert.equal(erUnlocked(s1, withCz([30])), false, "a cloze unit's fm card is missing");
  assert.equal(erUnlocked(s1, state()), false);
  assert.equal(erUnlocked(noCloze, state()), false, "no cloze tokens");
});

test("isUnlocked handles er", () => {
  assert.equal(isUnlocked("er:s1", withCz([8, 9]), content), true);
  assert.equal(isUnlocked("er:s1", withCz([8, 3]), content), false);
  assert.equal(isUnlocked("er:nope", withCz([8, 9]), content), false);
});

test("er attempts: units of cloze tokens plus head patterns", () => {
  const us = unitsRequiredForCard("er:s1", content).map((x) => x.u).sort();
  assert.deepEqual(us, ["avea.pres1sg", "pat:have-pres", "problema.sg"]);
  assert.deepEqual(erUnits(s1).find((x) => x.u === "pat:have-pres"), { u: "pat:have-pres", lx: "avea" });
  assert.deepEqual(unitsRequiredForCard("er:gone", content), []);
});

test("newErCards introduces unlocked, not-yet-introduced cards and honours cap and skip", () => {
  const st = withCz([8, 9]);
  assert.deepEqual(newErCards(st, content), ["er:s1"]);
  assert.deepEqual(newErCards(st, content, { skip: new Set(["s1"]) }), []);
  assert.deepEqual(newErCards(st, content, { cap: 0 }), []);
  st.cards["er:s1"] = newCard(NOW);
  assert.deepEqual(newErCards(st, content), []);
});

test("buildSession appends new er cards in session mode", () => {
  const st = withCz([8, 9]);
  const { queue } = buildSession({ mode: "session", state: st, content, now: NOW, rng: () => 0.5, newSentenceIds: [] });
  assert.ok(queue.some((q) => q.cardId === "er:s1" && q.isNew));
});

test("er has the lowest drill weight (FR-D9)", () => {
  assert.deepEqual(pickPerSentence(["er:s1", "xf:s1:0"]), ["xf:s1:0"]);
  assert.deepEqual(pickPerSentence(["er:s1", "cz:s1:0"]), ["er:s1", "cz:s1:0"]);
  assert.deepEqual(pickPerSentence(["fm:avea:pres1sg", "er:s1"]), ["fm:avea:pres1sg", "er:s1"], "fm has no sentence until shown");
});
