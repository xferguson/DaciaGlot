import { test } from "node:test";
import assert from "node:assert/strict";
import { sessionPace, weeklyIntake, nextBatchSize, learnBatch, recordSession } from "../app/js/core/pace.js";
import { dayKey } from "../app/js/core/session.js";
import { NOW, sentence, makeContent, state } from "./helpers/mini-content.mjs";

const MIN = 60000;
const content = makeContent([sentence("s1", "a b", ["x.f", "y.f"], { patterns: ["p1"] })]);

test("sessionPace counts new sentences, forms, patterns and pace per 10 min", () => {
  const start = NOW, end = NOW + 10 * MIN;
  const attempts = [
    { u: "x.f", lx: "x", c: 1, t: start + MIN, card: "fm:x:f", enc: 1 },
    { u: "x.f", lx: "x", c: 0, t: start + 2 * MIN, card: "fm:x:f", enc: 1 },
    { u: "y.f", lx: "y", c: 1, t: start + 3 * MIN, card: "fm:y:f", enc: 1 },
    { u: "z.f", lx: "z", c: 1, t: start + 4 * MIN, card: "fm:z:f" },
    { u: "w.f", lx: "w", c: 1, t: start - MIN, card: "fm:w:f", enc: 1 },
  ];
  const p = sessionPace(attempts, { s1: start + MIN, old: start - 5 * MIN }, start, end, content);
  assert.equal(p.newForms, 2);
  assert.equal(p.newSentences, 1);
  assert.deepEqual(p.newPatterns, ["p1"]);
  assert.equal(p.minutes, 10);
  assert.equal(p.perTen, 3);
  assert.equal(p.reviewShare, 1 / 3);
});

test("sessionPace on an empty session is all zeros", () => {
  const p = sessionPace([], {}, NOW, NOW, content);
  assert.deepEqual(p, { newForms: 0, newSentences: 0, newPatterns: [], minutes: 0, perTen: 0, reviewShare: 0 });
});

test("weeklyIntake sums newItems per rolling week, oldest first", () => {
  const history = { [dayKey(NOW)]: { newItems: 10 }, [dayKey(NOW - 3 * 864e5)]: { newItems: 5 }, [dayKey(NOW - 8 * 864e5)]: { newItems: 7 } };
  const w = weeklyIntake(history, NOW);
  assert.equal(w.length, 8);
  assert.deepEqual(w.at(-1), { label: "now", items: 15 });
  assert.deepEqual(w.at(-2), { label: "-1w", items: 7 });
  assert.equal(w[0].items, 0);
});

test("nextBatchSize grows, shrinks, holds and respects bounds", () => {
  assert.equal(nextBatchSize(16, 10, 15, 0.9), 20);
  assert.equal(nextBatchSize(16, 20, 15, 0.9), 16, "at/over target: unchanged");
  assert.equal(nextBatchSize(16, 10, 15, 0.7), 16, "middling accuracy: unchanged");
  assert.equal(nextBatchSize(16, 99, 15, 0.5), 12, "low accuracy shrinks even over target");
  assert.equal(nextBatchSize(38, 5, 15, 1), 40, "capped at max");
  assert.equal(nextBatchSize(6, 5, 15, 0.1), 5, "floored at min");
  assert.equal(nextBatchSize(16, 5, 15, null), 16, "no checks: unchanged");
});

test("recordSession logs intake, adapts only Learn, and learnBatch honours adaptiveBatch", () => {
  const pace = { newForms: 8, newSentences: 4, newPatterns: [], minutes: 12, perTen: 10, reviewShare: 0 };
  let s = recordSession(state(), { pace, accuracy: 0.9, learn: false, now: NOW });
  assert.equal(s.history[dayKey(NOW)].newItems, 12);
  assert.equal(s.pace.batch, null);
  s = recordSession(s, { pace, accuracy: 0.9, learn: true, now: NOW });
  assert.equal(s.history[dayKey(NOW)].newItems, 24);
  assert.equal(s.pace.batch, 19);
  assert.equal(learnBatch(s), 19);
  s.settings.adaptiveBatch = false;
  assert.equal(learnBatch(s), 15);
  const empty = recordSession(state(), { pace: { ...pace, newForms: 0, newSentences: 0 }, accuracy: null, learn: true, now: NOW });
  assert.equal(empty.pace.batch, null);
});
