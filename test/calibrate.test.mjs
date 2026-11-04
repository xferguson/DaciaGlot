import { test } from "node:test";
import assert from "node:assert/strict";
import { dailyNudge, calibrationSummary, recallEntry, appendRecall, defaultCalibration } from "../app/js/core/calibrate.js";
import { applyReview } from "../app/js/core/review.js";
import { defaultState } from "../app/js/data/store.js";
import { newCard } from "../app/js/core/fsrs.js";

const NOW = Date.UTC(2026, 5, 10, 12);
const DAY = 86400000;
const withLog = (n, ok, multiplier = 1) => ({
  multiplier, nudgedOn: null,
  log: Array.from({ length: n }, (_, i) => ({ t: NOW - DAY, gap: 8, ok: i < ok })),
});

test("fewer than 20 entries change nothing", () => {
  const c = withLog(19, 19);
  assert.equal(dailyNudge(c, 0.85, NOW), c);
});

test("98 % recall raises gaps by at most 5 %; 70 % lowers them by at most 5 %", () => {
  assert.equal(dailyNudge(withLog(50, 49), 0.85, NOW).multiplier, 1.05);
  assert.equal(dailyNudge(withLog(50, 35), 0.85, NOW).multiplier, 0.95);
});

test("a small gap to the target moves the multiplier proportionally", () => {
  const m = dailyNudge(withLog(100, 86), 0.85, NOW).multiplier;
  assert.ok(m > 1.01 && m < 1.03);
});

test("bounds 0.5 and 4, and once per local day", () => {
  assert.equal(dailyNudge(withLog(50, 50, 4), 0.85, NOW).multiplier, 4);
  assert.equal(dailyNudge(withLog(50, 0, 0.5), 0.85, NOW).multiplier, 0.5);
  const once = dailyNudge(withLog(50, 49), 0.85, NOW);
  assert.equal(dailyNudge(once, 0.85, NOW), once);
  assert.equal(dailyNudge(once, 0.85, NOW + DAY).multiplier > once.multiplier, true);
});

test("recallEntry: only due cards with a last gap of 4 d or more", () => {
  const prev = { ...newCard(NOW), lastReview: NOW - 5 * DAY, due: NOW - 1000 };
  assert.deepEqual(recallEntry(prev, 3, NOW), { t: NOW, gap: 5 - 1000 / DAY, ok: true });
  assert.equal(recallEntry(prev, 2, NOW).ok, true);
  assert.equal(recallEntry(prev, 1, NOW).ok, false);
  assert.equal(recallEntry({ ...prev, due: NOW + DAY }, 3, NOW), null, "not due");
  assert.equal(recallEntry({ ...prev, lastReview: NOW - 2 * DAY }, 3, NOW), null, "short gap");
  assert.equal(recallEntry(undefined, 3, NOW), null);
});

test("appendRecall trims to 60 days", () => {
  const c = { ...defaultCalibration(), log: [{ t: NOW - 61 * DAY, gap: 5, ok: true }] };
  assert.equal(appendRecall(c, { t: NOW, gap: 5, ok: true }, NOW).log.length, 1);
});

test("applyReview logs a due fm review, not an lr review, and uses the multiplier", () => {
  const st = defaultState(NOW);
  st.cards["fm:a0:base"] = { ...newCard(NOW), state: 2, lastReview: NOW - 5 * DAY, due: NOW - 10 };
  st.cards["lr:s0"] = { ...st.cards["fm:a0:base"] };
  st.calibration.multiplier = 2;
  const a = applyReview(st, "fm:a0:base", 3, [], NOW, null);
  assert.equal(a.calibration.log.length, 1);
  assert.equal(Math.round((a.cards["fm:a0:base"].due - NOW) / DAY), 30); // base 5 × 3, × multiplier 2
  const b = applyReview(st, "lr:s0", 3, [], NOW, null);
  assert.equal(b.calibration.log.length, 0);
});

test("calibrationSummary", () => {
  assert.deepEqual(calibrationSummary(withLog(41, 38, 1.32), 0.85, NOW), { target: 0.85, actual: 38 / 41, n: 41, multiplier: 1.32 });
  assert.equal(calibrationSummary(defaultCalibration(), 0.85, NOW).actual, null);
});
