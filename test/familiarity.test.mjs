// T39 (EXP-12, FR-R7): familiarity credit for words met in context.
import { test } from "node:test";
import assert from "node:assert/strict";
import { exposureCredit, FAMILIARITY } from "../app/js/core/familiarity.js";
import { partialCredit, scheduleCard } from "../app/js/core/schedule.js";
import { applyReview } from "../app/js/core/session.js";
import { creditProduced } from "../app/js/core/credit.js";
import { State } from "../app/js/core/fsrs.js";
import { state, NOW, sentence, makeContent } from "./helpers/mini-content.mjs";

const DAY = 86400000;
const fm = (gap, ago) => ({
  due: NOW - ago * DAY + gap * DAY, stability: gap, difficulty: 5, reps: 3, lapses: 0, state: State.Review, step: 0,
  lastReview: NOW - ago * DAY, lastGrade: 3,
});
const u = (lex) => ({ lex, form: "base" });
const S = sentence("s", "a b c d", [u("a"), u("b"), u("c"), u("d")]);
const content = makeContent([S], ["a", "b", "c", "d"].map((id) => ({ id, ...(id === "d" ? { trivial: true } : {}) })));
const st = (cards) => ({ ...state(), cards });
const medium = (c) => scheduleCard(c, 3, NOW).due - NOW;

test("seen bump is 25 % of a Medium step, produced-early is 50 %", () => {
  const c = fm(4, 2);
  const s = st({ "fm:b:base": c });
  const seen = exposureCredit(s, S, ["a.base"], "seen", NOW);
  assert.equal(seen.cards["fm:b:base"].due, partialCredit(c, 0.25, NOW).due);
  assert.ok(seen.cards["fm:b:base"].due > c.due);
  assert.equal(FAMILIARITY.produced, 0.5);
  // produced-early through creditProduced (fm is early: 2 of 4 days → on time at 50 %, so use 1 day)
  const early = st({ "fm:a:base": fm(4, 1) });
  const out = creditProduced(early, ["a.base"], 3, NOW);
  assert.equal(out.cards["fm:a:base"].due, partialCredit(early.cards["fm:a:base"], 0.5, NOW).due);
  assert.ok(medium(fm(4, 1)) > 0);
});

test("once per local day", () => {
  const s = st({ "fm:b:base": fm(4, 2) });
  const once = exposureCredit(s, S, [], "seen", NOW);
  assert.equal(once.familiarity["b.base"], "2026-01-10");
  const twice = exposureCredit(once, S, [], "seen", NOW);
  assert.equal(twice, once);
  const tomorrow = exposureCredit(once, S, [], "seen", NOW + DAY);
  assert.notEqual(tomorrow, once);
  assert.deepEqual(Object.keys(tomorrow.familiarity), ["b.base"]); // old days pruned
});

test("tested, claimed and trivial units are skipped; never-reviewed cards untouched", () => {
  const s = st({ "fm:a:base": fm(4, 2), "fm:b:base": fm(4, 2), "fm:c:base": fm(4, 2), "fm:d:base": fm(4, 2), "fm:z:base": { ...fm(4, 2), state: State.New, lastReview: null } });
  s.claimed["b.base"] = NOW;
  const out = exposureCredit(s, S, ["a.base"], "seen", NOW, content);
  assert.equal(out.cards["fm:a:base"], s.cards["fm:a:base"]);
  assert.equal(out.cards["fm:b:base"], s.cards["fm:b:base"]);
  assert.equal(out.cards["fm:d:base"], s.cards["fm:d:base"]);
  assert.ok(out.cards["fm:c:base"].due > s.cards["fm:c:base"].due);
  const unreviewed = st({ "fm:c:base": { ...fm(4, 2), state: State.New, lastReview: null } });
  assert.equal(exposureCredit(unreviewed, S, [], "seen", NOW), unreviewed);
});

test("never earlier", () => {
  const c = { ...fm(4, 3), due: NOW + 30 * DAY };
  const out = exposureCredit(st({ "fm:b:base": c }), S, [], "seen", NOW);
  assert.equal(out.cards["fm:b:base"].due, c.due);
});

test("a correct card credits the other words; a wrong one credits none", () => {
  const cards = { "fm:b:base": fm(4, 2), "er:s": fm(1, 1), "lr:s": fm(1, 1) };
  const s = st(cards);
  const ok = applyReview(s, "er:s", 3, [{ u: "a.base", lx: "a" }], NOW, content);
  assert.ok(ok.cards["fm:b:base"].due > cards["fm:b:base"].due);
  const bad = applyReview(s, "er:s", 1, [{ u: "a.base", lx: "a" }], NOW, content);
  assert.equal(bad.cards["fm:b:base"], cards["fm:b:base"]);
  const lr = applyReview(s, "lr:s", 3, [], NOW, content);
  assert.ok(lr.cards["fm:b:base"].due > cards["fm:b:base"].due);
});
