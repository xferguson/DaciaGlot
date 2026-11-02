// Q11: scheduling (ladder and scheduleCard); the grade table and ladder cases stay in session.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleCard, ladderDays } from "../app/js/core/schedule.js";
import { newCard } from "../app/js/core/fsrs.js";

const NOW = Date.UTC(2026, 0, 10, 12);
const DAY = 86400000;

test("scheduleCard: a new card answered Good is due on the first rung, and records lastGrade", () => {
  const c = scheduleCard(undefined, 3, NOW);
  assert.equal(c.due, NOW + DAY);
  assert.equal(c.lastGrade, 3);
});

test("scheduleCard: Good climbs the ladder from the previous gap; Easy waits three times as long", () => {
  const prev = { ...newCard(NOW), lastReview: NOW - 4 * DAY, due: NOW };
  assert.equal(scheduleCard(prev, 3, NOW).due, NOW + ladderDays(4, 3) * DAY);
  assert.equal(scheduleCard(prev, 4, NOW).due, NOW + ladderDays(4, 4) * DAY);
});

test("scheduleCard: Again and Hard keep the FSRS interval, not the ladder", () => {
  const prev = { ...newCard(NOW), lastReview: NOW - 4 * DAY, due: NOW };
  assert.equal(scheduleCard(prev, 1, NOW).lastGrade, 1);
  assert.notEqual(scheduleCard(prev, 2, NOW).due, NOW + ladderDays(4, 3) * DAY);
});
