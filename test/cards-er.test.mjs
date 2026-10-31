import { test } from "node:test";
import assert from "node:assert/strict";
import { isUnlocked, erUnlocked, erUnits, newErCards, pickPerSentence, buildCardId } from "../app/js/core/cards.js";
import { unitsRequiredForCard } from "../app/js/core/units.js";
import { buildSession, applyErReview, erMisses } from "../app/js/core/session.js";
import { checkAnswer } from "../app/js/core/check.js";
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
    // `stability` is now the scheduled gap in days
    st.cards[i === 0 ? "fm:avea:pres1sg" : "fm:problema:sg"] = { ...newCard(NOW), lastReview: NOW, due: NOW + stability * 86400000 };
  });
  return st;
}

test("er unlocks only when every cloze unit's fm card has scheduled gap ≥ 4 days", () => {
  assert.equal(erUnlocked(s1, withCz([4, 16])), true);
  assert.equal(erUnlocked(s1, withCz([30, 3.9])), false);
  assert.equal(erUnlocked(s1, withCz([30])), false, "a cloze unit's fm card is missing");
  assert.equal(erUnlocked(s1, state()), false);
  assert.equal(erUnlocked(noCloze, state()), false, "no cloze tokens");
});

test("isUnlocked handles er", () => {
  assert.equal(isUnlocked("er:s1", withCz([4, 9]), content), true);
  assert.equal(isUnlocked("er:s1", withCz([4, 3]), content), false);
  assert.equal(isUnlocked("er:nope", withCz([4, 9]), content), false);
});

test("er attempts: units of cloze tokens plus head patterns", () => {
  const us = unitsRequiredForCard("er:s1", content).map((x) => x.u).sort();
  assert.deepEqual(us, ["avea.pres1sg", "pat:have-pres", "problema.sg"]);
  assert.deepEqual(erUnits(s1).find((x) => x.u === "pat:have-pres"), { u: "pat:have-pres", lx: "avea" });
  assert.deepEqual(unitsRequiredForCard("er:gone", content), []);
});

test("newErCards introduces unlocked, not-yet-introduced cards and honours cap and skip", () => {
  const st = withCz([4, 9]);
  assert.deepEqual(newErCards(st, content), ["er:s1"]);
  assert.deepEqual(newErCards(st, content, { skip: new Set(["s1"]) }), []);
  assert.deepEqual(newErCards(st, content, { cap: 0 }), []);
  st.cards["er:s1"] = newCard(NOW);
  assert.deepEqual(newErCards(st, content), []);
});

test("buildSession appends new er cards in session mode", () => {
  const st = withCz([4, 9]);
  const { queue } = buildSession({ mode: "session", state: st, content, now: NOW, rng: () => 0.5, newSentenceIds: [] });
  assert.ok(queue.some((q) => q.cardId === "er:s1" && q.isNew));
});

test("er has the lowest drill weight (FR-D9)", () => {
  assert.deepEqual(pickPerSentence(["er:s1", "xf:s1:0"]), ["xf:s1:0"]);
  assert.deepEqual(pickPerSentence(["er:s1", "cz:s1:0"]), ["er:s1", "cz:s1:0"]);
  assert.deepEqual(pickPerSentence(["fm:avea:pres1sg", "er:s1"]), ["fm:avea:pres1sg", "er:s1"], "fm has no sentence until shown");
});

test("er unlocks for a claimed unit without an fm card", () => {
  const st = withCz([16]);
  st.claimed = { "problema.sg": NOW };
  assert.equal(erUnlocked(s1, st), true);
});

// --- part-level credit (T27) ---
const diffOf = (...st) => st.map((status, i) => ({ token: s1.tokens[i].t, status }));
const units = () => unitsRequiredForCard("er:s1", content);

test("erMisses blames only the wrong cloze token", () => {
  const m = erMisses(s1, diffOf("ok", "ok", "wrong"));
  assert.deepEqual(m.missed, ["problema.sg"]);
  assert.deepEqual(m.ok, ["avea.pres1sg"]);
  assert.deepEqual(m.missedTokens, ["problemă"]);
  assert.equal(erMisses(s1, diffOf("ok", "ok")), null, "misaligned diff");
});

test("a contraction-equivalent answer blames no token", () => {
  const m = erMisses(s1, checkAnswer("Am o problema", s1.ro).diff);
  assert.deepEqual(m.missed, []);
  const m2 = erMisses(s1, checkAnswer("am o problemă", s1.ro).diff);
  assert.deepEqual(m2.missed, []);
});

test("one wrong token: only that unit's fm gets Again; the rest get c:1 and keep their schedule", () => {
  const st = withCz([16, 16]);
  const before = st.cards["fm:avea:pres1sg"];
  const out = applyErReview(st, "er:s1", 1, units(), erMisses(s1, diffOf("ok", "ok", "wrong")), NOW, content);
  assert.deepEqual(out.cards["fm:avea:pres1sg"], before);
  assert.equal(out.cards["fm:problema:sg"].lapses >= 0, true);
  assert.ok(out.cards["fm:problema:sg"].due < NOW + 86400000 * 4, "back soon");
  const att = (u) => out.attempts.filter((a) => a.u === u).map((a) => a.c);
  assert.deepEqual(att("avea.pres1sg"), [1]);
  assert.deepEqual(att("problema.sg"), [0]);
  assert.deepEqual(att("pat:have-pres"), [0], "the er card itself is graded wrong");
  assert.ok(out.cards["er:s1"]);
});

test("a miss on a claimed unit drops that claim and creates its fm due now", () => {
  const st = withCz([16]);
  st.claimed = { "problema.sg": NOW - 1, "avea.pres1sg": NOW - 1 };
  const out = applyErReview(st, "er:s1", 1, units(), erMisses(s1, diffOf("ok", "ok", "wrong")), NOW, content);
  assert.deepEqual(Object.keys(out.claimed), ["avea.pres1sg"]);
  assert.equal(out.cards["fm:problema:sg"].due, NOW);
});

test("without an alignment the whole card is graded", () => {
  const st = withCz([16, 16]);
  const out = applyErReview(st, "er:s1", 1, units(), null, NOW, content);
  assert.deepEqual(out.attempts.map((a) => a.c), units().map(() => 0));
});
