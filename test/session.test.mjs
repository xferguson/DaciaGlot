import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gradeFromResult, buildSession, applyReview, dueCards, requeueWrong, dayKey, interimNewSentences, mixPlan,
} from "../app/js/core/session.js";
import { newCard } from "../app/js/core/fsrs.js";
import { makeContent, sentence, state, NOW } from "./helpers/mini-content.mjs";

const u = (lex) => ({ lex, form: "base" });
const mk = (n) => Array.from({ length: n }, (_, i) =>
  sentence(`s${String(i).padStart(2, "0")}`, `a${i} b${i}`, [u(`a${i}`), u(`b${i}`)]));
const content = makeContent(mk(30));
const rng = () => 0.5;

function withDue(n) {
  const st = state();
  for (let i = 0; i < n; i++) {
    const id = `lr:s${String(i).padStart(2, "0")}`;
    st.cards[id] = { ...newCard(NOW), due: NOW - (i + 1) * 1000 };
  }
  return st;
}

test("gradeFromResult table", () => {
  const g = (o) => gradeFromResult({ usedHint: false, attemptNo: 1, tooEasy: false, ...o });
  assert.equal(g({ result: "correct" }), 3);
  assert.equal(g({ result: "correct-diacritics" }), 3);
  assert.equal(g({ result: "correct", usedHint: true }), 2);
  assert.equal(g({ result: "correct", attemptNo: 2 }), 2);
  assert.equal(g({ result: "correct", tooEasy: true }), 4);
  assert.equal(g({ result: "wrong" }), 1);
  assert.equal(g({ result: "wrong", tooEasy: true }), 1);
});

test("Quick: most overdue first, capped at 15, only due", () => {
  const st = withDue(20);
  st.cards["lr:s25"] = { ...newCard(NOW), due: NOW + 1e6 };
  const { queue } = buildSession({ mode: "quick", state: st, content, now: NOW, rng });
  assert.equal(queue.length, 15);
  assert.equal(queue[0].cardId, "lr:s19"); // most overdue
  assert.ok(queue.every((q) => !q.isNew));
  assert.equal(dueCards(st, content, NOW).length, 20);
});

test("Session: no two new lr cards adjacent; new cz follow their lr", () => {
  const st = withDue(10);
  const ids = ["s20", "s21", "s22", "s23"];
  const { queue, estimateSec } = buildSession({ mode: "session", state: st, content, now: NOW, rng, newSentenceIds: ids });
  const newLr = queue.map((q, i) => (q.isNew && q.cardId.startsWith("lr:") ? i : -1)).filter((i) => i >= 0);
  assert.equal(newLr.length, 4);
  for (let i = 1; i < newLr.length; i++) assert.ok(newLr[i] - newLr[i - 1] > 1);
  for (const id of ids) {
    assert.ok(queue.findIndex((q) => q.cardId === `lr:${id}`) < queue.findIndex((q) => q.cardId === `cz:${id}:0`));
  }
  assert.equal(queue.length, 10 + 8);
  assert.equal(estimateSec, 10 * 12 + 4 * 40);
});

test("Session uses interim order when newSentenceIds absent, honoring newPerSession", () => {
  const st = state();
  st.settings.newPerSession = 3;
  assert.deepEqual(interimNewSentences(3, st, content), ["s00", "s01", "s02"]);
  const { queue } = buildSession({ mode: "session", state: st, content, now: NOW, rng });
  assert.equal(queue.filter((q) => q.cardId.startsWith("lr:")).length, 3);
});

test("applyReview: cz records attempts, lr records exposure only", () => {
  const st = state();
  const lr = applyReview(st, "lr:s00", 3, [], NOW, content);
  assert.equal(lr.attempts.length, 0);
  assert.equal(lr.seenSentences.s00, NOW);
  assert.deepEqual(lr.lexemeSentences.a0, ["s00"]);
  assert.equal(lr.history[dayKey(NOW)].newSentences, 1);
  assert.ok(lr.cards["lr:s00"].reps === 1);
  const cz = applyReview(lr, "cz:s00:0", 1, [{ u: "a0.base", lx: "a0" }], NOW, content);
  assert.deepEqual(cz.attempts, [{ u: "a0.base", lx: "a0", c: 0, t: NOW, card: "cz:s00:0" }]);
  const ok = applyReview(cz, "cz:s00:0", 2, [{ u: "a0.base", lx: "a0" }], NOW + 1, content);
  assert.equal(ok.attempts[1].c, 1);
  assert.equal(ok.history[dayKey(NOW)].cards, 3);
  assert.equal(ok.history[dayKey(NOW)].newSentences, 1);
  assert.equal(st.attempts.length, 0, "input not mutated");
  const again = applyReview(lr, "lr:s00", 3, [], NOW + 5, content);
  assert.equal(again.seenSentences.s00, NOW, "first-seen ts preserved");
  assert.equal(again.lexemeSentences.a0.length, 1);
});

test("requeueWrong inserts 3-5 cards later once", () => {
  const queue = Array.from({ length: 10 }, (_, i) => ({ cardId: `c${i}`, isNew: false }));
  const at = requeueWrong(queue, 2, queue[2], () => 0);
  assert.equal(at, 5);
  assert.equal(queue[5].cardId, "c2");
  assert.equal(requeueWrong(queue, 2, queue[2], () => 0.99), 7);
  const short = [{ cardId: "x" }];
  assert.equal(requeueWrong(short, 0, short[0], rng), 1);
});

test("mixPlan: new sentences fill the budget left after reviews", () => {
  assert.deepEqual(mixPlan(0, 8), { newCount: 8, reviewPct: 0 });
  assert.equal(mixPlan(20, 8).newCount, 8); // 720 - 240 = 480 s → 12, capped at 8
  assert.equal(mixPlan(40, 8).newCount, 6);
  assert.equal(mixPlan(50, 8).newCount, 3);
  assert.equal(mixPlan(60, 8).newCount, 0);
  assert.equal(mixPlan(60, 8).reviewPct, 100);
  assert.equal(mixPlan(0, 0).reviewPct, 0);
});

test("Review: every due card, uncapped, nothing new", () => {
  const st = withDue(20);
  const { queue } = buildSession({ mode: "review", state: st, content, now: NOW, rng });
  assert.equal(queue.length, 20);
  assert.ok(queue.every((q) => !q.isNew));
});

test("Learn: new sentences only, no due cards", () => {
  const st = withDue(10);
  st.settings.newPerSession = 3;
  const { queue } = buildSession({ mode: "learn", state: st, content, now: NOW, rng });
  assert.ok(queue.length > 0);
  assert.ok(queue.every((q) => q.isNew));
  assert.equal(queue.filter((q) => q.cardId.startsWith("lr:")).length, 3);
});

test("Mix: fewer new sentences under a heavy review load, none when reviews fill the budget", () => {
  const light = withDue(10);
  const a = buildSession({ mode: "mix", state: light, content, now: NOW, rng });
  assert.equal(a.plan.newCount, light.settings.newPerSession);
  const heavy = withDue(25);
  heavy.settings.newPerSession = 20;
  const b = buildSession({ mode: "mix", state: heavy, content, now: NOW, rng });
  assert.equal(b.plan.newCount, 10); // (720 - 25·12) / 40 = 10.5
  assert.equal(b.queue.filter((q) => !q.isNew).length, 25);
  assert.ok(b.queue.filter((q) => q.isNew && q.cardId.startsWith("lr:")).length <= 10);
  const c = buildSession({ mode: "mix", state: withDue(60), content: makeContent(mk(70)), now: NOW, rng });
  assert.equal(c.plan.newCount, 0);
  assert.equal(c.queue.length, 60);
  assert.ok(c.queue.every((q) => !q.isNew));
});
