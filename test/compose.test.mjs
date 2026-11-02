// T32 (EXP-07): easy forms, composite er reviews.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isEasy, erUnlocked } from "../app/js/core/cards.js";
import { pickComposite } from "../app/js/core/carrier.js";
import { buildSession, applyErReview, erMisses } from "../app/js/core/session.js";
import { newCard } from "../app/js/core/fsrs.js";
import { makeContent, state, NOW } from "./helpers/mini-content.mjs";

const DAY = 86400000;
const tok = (t, lex, cloze = true) => ({ t, units: [{ lex, form: "base" }], cloze: cloze || undefined });
const sent = (id, lexes, extra = {}) => ({
  id, ro: lexes.join(" "), en: `EN ${id}`, level: "A1", stage: 1, situations: ["x"], patterns: [], register: "neutral",
  tokens: lexes.map((l) => tok(l, l)), ...extra,
});
const lexemes = (names) => names.map((id) => ({ id, lemma: id, pos: "noun", gloss: id, forms: { base: id } }));
const fm = (lex, { gap = 1, grade = 3, due = NOW - 1000 } = {}) =>
  ({ ...newCard(NOW), lastReview: due - gap * DAY, due, lastGrade: grade });
const lr = (st, ...sids) => { for (const sid of sids) st.seenSentences[sid] = NOW - 10 * DAY; };

test("isEasy: claimed, last grade Easy, or gap ≥ 4 days; not a Good at 1 day", () => {
  const st = state();
  st.cards["fm:a:base"] = fm("a", { gap: 1, grade: 3 });
  st.cards["fm:b:base"] = fm("b", { gap: 1, grade: 4 });
  st.cards["fm:c:base"] = fm("c", { gap: 4, grade: 3 });
  st.cards["fm:d:base"] = fm("d", { gap: 4, grade: 1 }); // gap stored but last grade Again → gap still counts
  st.claimed["e.base"] = NOW;
  assert.equal(isEasy(st, "a.base", NOW), false);
  assert.equal(isEasy(st, "b.base", NOW), true);
  assert.equal(isEasy(st, "c.base", NOW), true);
  assert.equal(isEasy(st, "e.base", NOW), true);
  assert.equal(isEasy(st, "zz.base", NOW), false, "no card");
  st.cards["fm:b:base"] = { ...st.cards["fm:b:base"], lastGrade: 1 };
  assert.equal(isEasy(st, "b.base", NOW), false, "a later Again undoes Easy");
});

test("erUnlocked once every cloze form is easy (no 4-day wait after an Easy)", () => {
  const s = sent("s1", ["a", "b"]);
  const st = state();
  st.cards["fm:a:base"] = fm("a", { gap: 1, grade: 4 });
  assert.equal(erUnlocked(s, st, NOW), false, "b has no card");
  st.cards["fm:b:base"] = fm("b", { gap: 1, grade: 4 });
  assert.equal(erUnlocked(s, st, NOW), true);
  st.cards["fm:b:base"] = fm("b", { gap: 1, grade: 3 });
  assert.equal(erUnlocked(s, st, NOW), false);
});

const content = makeContent(
  [sent("p", ["a", "b", "c"]), sent("q", ["a", "b"]), sent("r", ["a", "z"]), sent("noen", ["a", "b", "c", "d"], { en: undefined })],
  lexemes(["a", "b", "c", "d", "z"]),
);

test("pickComposite: most due easy forms; needs ≥ 2; never an unknown other unit", () => {
  const st = state();
  lr(st, "p", "q", "r");
  for (const l of ["a", "b", "c"]) st.attempts.push({ u: `${l}.base`, lx: l, c: 1, t: NOW - 30 * DAY, card: "fm:" + l });
  const pick = pickComposite(["a.base", "b.base", "c.base"], st, content, NOW, () => 0);
  assert.equal(pick.sentenceId, "p");
  assert.deepEqual(pick.units, ["a.base", "b.base", "c.base"]);
  assert.equal(pickComposite(["a.base"], st, content, NOW, () => 0), null, "one form is not a composite");
  assert.equal(pickComposite(["a.base", "d.base"], st, content, NOW, () => 0), null, "the only sentence with both has no English");
  assert.equal(pickComposite(["a.base", "z.base"], st, content, NOW, () => 0).sentenceId, "r");
});

test("pickComposite: unknown other unit blocks a sentence; recent carrier is skipped; unseen preferred on a tie", () => {
  const st = state();
  lr(st, "q");
  for (const l of ["a", "b"]) st.attempts.push({ u: `${l}.base`, lx: l, c: 1, t: NOW - 30 * DAY, card: "fm:" + l });
  // p needs c, which was never correct → ineligible; q and p both hold a+b, only q is eligible
  assert.equal(pickComposite(["a.base", "b.base"], st, content, NOW, () => 0).sentenceId, "q");
  st.attempts.push({ u: "a.base", lx: "a", c: 1, t: NOW - DAY, card: "cz:q:0" });
  assert.equal(pickComposite(["a.base", "b.base"], st, content, NOW, () => 0), null, "q carried a form 1 day ago; p has unknown c");
  st.attempts.push({ u: "c.base", lx: "c", c: 1, t: NOW - 30 * DAY, card: "fm:c" });
  const pick = pickComposite(["a.base", "b.base"], st, content, NOW, () => 0);
  assert.equal(pick.sentenceId, "p", "p is unseen and now eligible");
});

function sessionState() {
  const st = state();
  lr(st, "q"); // p stays unseen
  for (const l of ["a", "b", "c", "d", "z"]) st.attempts.push({ u: `${l}.base`, lx: l, c: 1, t: NOW - 30 * DAY, card: "fm:" + l });
  return st;
}

test("review session: 6 due easy forms that fit 2 sentences give 2 composites and no single fm for them", () => {
  const c2 = makeContent(
    [sent("x1", ["a", "b", "c"]), sent("x2", ["d", "e", "f"]), sent("x3", ["a", "d"])],
    lexemes(["a", "b", "c", "d", "e", "f"]),
  );
  const st = state();
  for (const l of ["a", "b", "c", "d", "e", "f"]) {
    st.cards[`fm:${l}:base`] = fm(l, { gap: 1, grade: 4 });
    st.attempts.push({ u: `${l}.base`, lx: l, c: 1, t: NOW - 30 * DAY, card: "fm:" + l });
  }
  const out = buildSession({ mode: "review", state: st, content: c2, now: NOW, rng: () => 0 });
  const comps = out.queue.filter((q) => q.composite);
  assert.equal(comps.length, 2);
  assert.deepEqual(comps.map((q) => q.cardId).sort(), ["er:x1", "er:x2"]);
  assert.ok(comps.every((q) => q.isNew === false && q.units.length === 3));
  assert.equal(out.queue.filter((q) => q.cardId.startsWith("fm:")).length, 0);
  assert.equal(out.estimateSec, 2 * 2 * 12, "a composite counts double");
});

test("forms that fit no composite stay single fm reviews", () => {
  const st = state();
  lr(st, "q");
  st.cards["fm:a:base"] = fm("a", { gap: 1, grade: 4 });
  st.cards["fm:d:base"] = fm("d", { gap: 1, grade: 4 });
  const out = buildSession({ mode: "review", state: st, content, now: NOW, rng: () => 0 });
  assert.deepEqual(out.queue.map((q) => q.cardId).sort(), ["fm:a:base", "fm:d:base"]);
});

test("applyErReview with a composite: part-level credit, correct forms reviewed Good, missed ones Again; unseen sentence becomes seen", () => {
  const st = sessionState();
  for (const l of ["a", "b", "c"]) st.cards[`fm:${l}:base`] = fm(l, { gap: 1, grade: 4 });
  const s = content.sentences.get("p");
  const units = [{ u: "a.base", lx: "a" }, { u: "b.base", lx: "b" }, { u: "c.base", lx: "c" }];
  const diff = [{ status: "ok" }, { status: "wrong" }, { status: "ok" }];
  const out = applyErReview(st, "er:p", 2, units, erMisses(s, diff), NOW, content, "er:p", ["a.base", "b.base", "c.base"]);
  assert.equal(out.cards["fm:b:base"].lastGrade, 1);
  assert.ok(out.cards["fm:b:base"].due < NOW + DAY);
  for (const l of ["a", "c"]) {
    assert.equal(out.cards[`fm:${l}:base`].lastGrade, 2, "Hard retained for the retried answer");
    assert.ok(out.cards[`fm:${l}:base`].due > NOW);
  }
  assert.ok("p" in out.seenSentences);
  assert.deepEqual(out.lexemeSentences.a, ["p"]);
  // Whole-card grading, no diff alignment: Good passes every form
  const good = applyErReview(st, "er:p", 3, units, null, NOW, content, "er:p", ["a.base", "b.base"]);
  assert.equal(good.cards["fm:a:base"].lastGrade, 3);
  assert.equal(good.cards["fm:b:base"].lastGrade, 3);
  assert.equal(good.cards["fm:c:base"].lastGrade, 4, "c was not part of the composite");
  const bad = applyErReview(st, "er:p", 1, units, null, NOW, content, "er:p", ["a.base", "b.base"]);
  assert.equal(bad.cards["fm:a:base"].lastGrade, 1);
});
