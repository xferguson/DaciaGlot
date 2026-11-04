// T38 (EXP-12, FR-R7): a word produced correctly in a bigger card reviews its own fm card when on time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { creditProduced } from "../app/js/core/credit.js";
import { applyErReview, applyReview } from "../app/js/core/session.js";
import { State } from "../app/js/core/fsrs.js";
import { state, NOW } from "./helpers/mini-content.mjs";

const DAY = 86400000;
/** A Review-state fm card with a `gap`-day schedule last reviewed `ago` days ago. */
const fm = (gap, ago) => ({
  due: NOW - ago * DAY + gap * DAY, stability: gap, difficulty: 5, reps: 3, lapses: 0, state: State.Review, step: 0,
  lastReview: NOW - ago * DAY, lastGrade: 3,
});
const st = (cards) => ({ ...state(), cards: { "er:s": { ...fm(1, 1) }, ...cards } });
const units = (...us) => us.map((u) => ({ u, lx: u.split(".")[0] }));
const reviewed = (before, after) => after.lastReview === NOW && after.lastReview !== before.lastReview;

test("on-time fm cards get a full review; Hard stays Hard", () => {
  const s = st({ "fm:a:base": fm(4, 3), "fm:b:base": fm(4, 3) });
  const good = creditProduced(s, ["a.base"], 3, NOW);
  assert.ok(reviewed(s.cards["fm:a:base"], good.cards["fm:a:base"]));
  assert.equal(good.cards["fm:a:base"].lastGrade, 3);
  assert.equal(good.cards["fm:b:base"], s.cards["fm:b:base"]);
  assert.equal(creditProduced(s, ["a.base"], 2, NOW).cards["fm:a:base"].lastGrade, 2);
  assert.notEqual(s.cards["fm:a:base"].lastReview, NOW); // input untouched
});

test("early cards, claimed units and units without a Review fm card are untouched", () => {
  const s = st({ "fm:a:base": fm(4, 1), "fm:c:base": fm(4, 4) });
  s.claimed["c.base"] = NOW;
  const out = creditProduced(s, ["a.base", "c.base", "z.base"], 3, NOW);
  assert.equal(out.cards["fm:c:base"], s.cards["fm:c:base"]);
  assert.equal(out.cards["fm:a:base"].lastReview, s.cards["fm:a:base"].lastReview); // early: partial credit only (T39), no review
  assert.ok(out.cards["fm:a:base"].due >= s.cards["fm:a:base"].due);
});

test("correct er reviews the on-time fm of its correct parts; a missed part still fails", () => {
  const s = st({ "fm:a:base": fm(4, 3), "fm:b:base": fm(4, 3), "fm:c:base": fm(4, 1) });
  const out = applyErReview(s, "er:s", 3, units("a.base", "b.base", "c.base"), { missed: ["b.base"], ok: ["a.base", "c.base"], missedTokens: ["b"] }, NOW, null);
  assert.ok(reviewed(s.cards["fm:a:base"], out.cards["fm:a:base"]));
  assert.equal(out.cards["fm:b:base"].lastGrade, 1);
  assert.equal(out.cards["fm:c:base"].lastReview, s.cards["fm:c:base"].lastReview); // early: partial credit only (T39)
});

test("composite units are reviewed once, not twice", () => {
  const s = st({ "fm:a:base": fm(4, 3), "fm:b:base": fm(4, 3) });
  const once = applyErReview(s, "er:s", 3, units("a.base", "b.base"), null, NOW, null, "er:s", ["a.base", "b.base"]);
  const withMiss = applyErReview(s, "er:s", 3, units("a.base", "b.base"), { missed: [], ok: ["a.base", "b.base"], missedTokens: [] }, NOW, null, "er:s", ["a.base"]);
  assert.equal(once.cards["fm:a:base"].reps, 4);
  assert.equal(withMiss.cards["fm:a:base"].reps, 4); // composite only
  assert.equal(withMiss.cards["fm:b:base"].reps, 4); // credit only
});

test("claimed units are skipped by er credit", () => {
  const s = st({ "fm:a:base": fm(4, 3) });
  s.claimed["a.base"] = NOW;
  const out = applyErReview(s, "er:s", 3, units("a.base"), { missed: [], ok: ["a.base"], missedTokens: [] }, NOW, null);
  assert.equal(out.cards["fm:a:base"], s.cards["fm:a:base"]);
});

test("xf and sb credit their target units when passed", () => {
  for (const type of ["xf", "sb"]) {
    const id = `${type}:s:0`;
    const s = st({ "fm:a:base": fm(4, 3), [id]: fm(1, 1) });
    const ok = applyReview(s, id, 3, units("a.base"), NOW, null);
    assert.ok(reviewed(s.cards["fm:a:base"], ok.cards["fm:a:base"]));
    const bad = applyReview(s, id, 1, units("a.base"), NOW, null);
    assert.equal(bad.cards["fm:a:base"], s.cards["fm:a:base"]);
  }
});
