// Q11: review transitions that moved to review.js; the bulk of their cases stay in session.test.mjs and compose.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { isClaimedCard, claimForm, unclaimForm, markDifficult, nextDayStart } from "../app/js/core/review.js";
import { state, NOW } from "./helpers/mini-content.mjs";

test("isClaimedCard: only an fm card of a claimed form", () => {
  const st = claimForm(state(), "a.base", NOW);
  assert.equal(isClaimedCard("fm:a:base", st), true);
  assert.equal(isClaimedCard("fm:b:base", st), false);
  assert.equal(isClaimedCard("lr:a", st), false);
  assert.equal(isClaimedCard("fm:a:base", unclaimForm(st, "a.base", NOW)), false);
});

test("claims and markDifficult return new states", () => {
  const st = state();
  const c = claimForm(st, "a.base", NOW);
  assert.notEqual(c, st);
  assert.deepEqual(st.claimed, {});
  assert.equal(markDifficult(st, "lr:a", NOW).difficult["lr:a"], NOW);
  assert.ok(nextDayStart(NOW) > NOW);
});
