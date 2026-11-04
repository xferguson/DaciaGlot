// Scheduling (T37, FR-S1): gap rules, partial credit.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleCard, partialCredit, MAX_GAP_DAYS } from "../app/js/core/schedule.js";
import { newCard } from "../app/js/core/fsrs.js";
import { startOfDayPlus } from "../app/js/core/time.js";

const NOW = Date.UTC(2026, 0, 10, 12);
const DAY = 86400000;

/** Review a card through `grades`, each when it falls due; returns the whole-day gaps. */
function run(grades, opts) {
  let card;
  let t = NOW;
  const gaps = [];
  for (const g of grades) {
    card = scheduleCard(card, g, t, opts);
    gaps.push(Math.round((card.due - t) / DAY));
    t = card.due;
  }
  return { gaps, card };
}

test("first gaps are 2 / 4 / 10 d and lastGrade is recorded", () => {
  for (const [g, d] of [[2, 2], [3, 4], [4, 10]]) {
    const c = scheduleCard(undefined, g, NOW);
    assert.equal(c.due, NOW + d * DAY);
    assert.equal(c.baseGap, d);
    assert.equal(c.lastGrade, g);
  }
});

test("later gaps grow ×1.5 / ×3 / ×6 from baseGap", () => {
  assert.deepEqual(run([3, 3, 3]).gaps, [4, 12, 36]);
  assert.deepEqual(run([4, 4]).gaps, [10, 60]);
  assert.equal(run([2, 2]).card.baseGap, 3);
});

test("Hard-only successes strictly lengthen", () => {
  const { gaps } = run([2, 2, 2, 2, 2]);
  assert.deepEqual(gaps.slice(0, 4), [2, 3, 5, 7]);
  for (let i = 1; i < gaps.length; i++) assert.ok(gaps[i] > gaps[i - 1]);
});

test("the multiplier scales gaps without compounding", () => {
  const a = run([3, 3, 3], { multiplier: 1.5 });
  assert.deepEqual(a.gaps, [6, 18, 54]);
  assert.equal(a.card.baseGap, 36);
});

test("a success never shortens the gap, even after the multiplier drops", () => {
  const long = run([3, 3], { multiplier: 2 }).card; // gap 24
  const c = scheduleCard(long, 3, long.due, { multiplier: 0.5 });
  assert.equal(Math.round((c.due - long.due) / DAY), 25);
});

test("the gap is capped at 365 d", () => {
  const { gaps } = run([4, 4, 4, 4]);
  assert.equal(Math.max(...gaps), MAX_GAP_DAYS);
  assert.equal(gaps.at(-1), MAX_GAP_DAYS);
});

test("wrong is due at the next local midnight and resets baseGap", () => {
  const good = run([3, 3]).card;
  const t = good.due;
  const w = scheduleCard(good, 1, t);
  assert.equal(w.due, startOfDayPlus(t, 1));
  assert.equal(w.baseGap, 0);
  const again = scheduleCard(w, 3, w.due);
  assert.equal(again.baseGap, 4);
});

test("a card from before baseGap joins at its last gap", () => {
  const old = { ...newCard(NOW), state: 2, lastReview: NOW - 16 * DAY, due: NOW };
  assert.equal(scheduleCard(old, 3, NOW).baseGap, 48);
});

test("partialCredit: never earlier, scales with the fraction, unchanged when never reviewed, sets lastCredit", () => {
  const card = run([3, 3]).card;
  const t = card.lastReview + 2 * DAY;
  const full = partialCredit(card, 1, t);
  const half = partialCredit(card, 0.5, t);
  assert.ok(full.due > half.due && half.due >= card.due);
  assert.equal(full.lastCredit, t);
  assert.equal(full.baseGap, card.baseGap);
  assert.equal(full.reps, card.reps);
  assert.equal(full.lastReview, card.lastReview);
  for (const f of [0.01, 0.5, 1]) for (const at of [card.lastReview, t, card.due - 1]) assert.ok(partialCredit(card, f, at).due >= card.due, "never earlier");
  const fresh = newCard(NOW);
  assert.equal(partialCredit(fresh, 1, NOW), fresh);
});
