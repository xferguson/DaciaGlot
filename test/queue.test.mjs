// Q11: the named steps of the session pipeline, tested one by one (the golden test pins them together).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MODES, selectDue, trimToBudget, pickNew, groupNew, interleave, estimate, newSentenceSec,
  QUICK_CAP, SEC_PER_REVIEW, SEC_PER_NEW, SEC_PER_NEW_FAST, MIX_BUDGET_SEC, MIX_MIN_NEW,
} from "../app/js/core/queue.js";
import * as barrel from "../app/js/core/session.js";
import { newCard } from "../app/js/core/fsrs.js";
import { makeContent, sentence, state, NOW } from "./helpers/mini-content.mjs";

const u = (lex) => ({ lex, form: "base" });
const content = makeContent(Array.from({ length: 12 }, (_, i) => sentence(`s${String(i).padStart(2, "0")}`, `a${i} b${i}`, [u(`a${i}`), u(`b${i}`)])));
const rng = () => 0.5;
const ctx = (st = state(), extra = {}) => ({ focus: null, state: st, content, now: NOW, rng, ...extra });
const dueState = (n) => {
  const st = state();
  for (let i = 0; i < n; i++) st.cards[`lr:s${String(i).padStart(2, "0")}`] = { ...newCard(NOW), due: NOW - (i + 1) * 1000 };
  return st;
};

test("MODES: the five modes as data; an unknown mode behaves as `session`", () => {
  assert.deepEqual(Object.keys(MODES), ["quick", "review", "learn", "mix", "session"]);
  assert.equal(MODES.quick.cap, QUICK_CAP);
  assert.equal(MODES.learn.due, false);
  assert.equal(MODES.mix.newItems, "mix");
  const a = barrel.buildSession({ mode: "nope", ...ctx(dueState(2)) });
  const b = barrel.buildSession({ mode: "session", ...ctx(dueState(2)) });
  assert.deepEqual(a, b);
});

test("selectDue: most overdue first, as non-new items", () => {
  const { items } = selectDue(MODES.review, ctx(dueState(3)));
  assert.deepEqual(items.map((q) => q.cardId), ["lr:s02", "lr:s01", "lr:s00"]);
  assert.ok(items.every((q) => q.isNew === false));
});

test("trimToBudget: keeps the due cards while they fit, trims the oldest-due-first remainder when they don't", () => {
  const few = [{ cardId: "a" }, { cardId: "b" }];
  const r = trimToBudget(few, 5);
  assert.equal(r.due, few);
  assert.equal(r.plan.newCount, 5);
  const many = Array.from({ length: 80 }, (_, i) => ({ cardId: `c${i}` }));
  const t = trimToBudget(many, 5);
  assert.ok(t.due.length < many.length);
  assert.deepEqual(t.due, many.slice(0, t.due.length));
  assert.equal(t.plan.newCount, MIX_MIN_NEW);
  assert.ok(t.due.length * SEC_PER_REVIEW + t.plan.newCount * SEC_PER_NEW <= MIX_BUDGET_SEC);
});

test("pickNew: uses newSentenceIds as given; a new profile gets a list; learn mode is sized by learnPlan", () => {
  assert.deepEqual(pickNew(MODES.session, { ...ctx(), newSentenceIds: ["s03"] }), { ids: ["s03"] });
  const fixed = pickNew(MODES.session, ctx());
  assert.equal(fixed.ids.length, state().settings.newPerSession);
  assert.ok(pickNew(MODES.learn, ctx()).ids.length > 0);
});

test("groupNew: one group per sentence, led by its lr, with one combined check; a shared form is claimed once", () => {
  const { groups, assigned } = groupNew(["s00", "s01"], ctx());
  assert.equal(groups.length, 2);
  assert.equal(groups[0][0].cardId, "lr:s00");
  assert.ok(groups.every((g) => g.every((q) => q.isNew)));
  const checks = groups.flat().filter((q) => q.check);
  assert.equal(checks.length, groups.filter((g) => g.some((q) => q.forms)).length);
  for (const c of checks) for (const f of c.forms) assert.ok(assigned.has(f));
  assert.deepEqual(groupNew([], ctx()).groups, []);
});

test("interleave: due cards are spread between the groups, drills go last", () => {
  const due = ["d1", "d2", "d3", "d4"].map((cardId) => ({ cardId }));
  const groups = [[{ cardId: "n1" }, { cardId: "c1" }], [{ cardId: "n2" }]];
  const drills = [{ cardId: "x1" }];
  const q = interleave(due, groups, drills).map((x) => x.cardId);
  assert.deepEqual([...q].sort(), ["c1", "d1", "d2", "d3", "d4", "n1", "n2", "x1"]);
  assert.ok(q.indexOf("n1") < q.indexOf("c1"));
  assert.equal(q.at(-1), "x1");
  assert.deepEqual(interleave(due, [], []).map((x) => x.cardId), ["d1", "d2", "d3", "d4"]);
});

test("estimate: due + drills + new sentences by forms, cheaper per new sentence in Learn", () => {
  const due = [{ cardId: "a" }, { cardId: "er:s", composite: true }];
  const groups = [[{ cardId: "lr:s1" }, { cardId: "fm:x", forms: ["fm:x", "fm:y"] }], [{ cardId: "pg:f", members: ["a", "b", "c"] }]];
  const drills = [{ cardId: "xf:s" }];
  const base = 3 * SEC_PER_REVIEW + SEC_PER_NEW;
  assert.equal(estimate(due, groups, drills, false), base + newSentenceSec(2) + newSentenceSec(0) + 20);
  assert.equal(estimate([], [], [], true), 0);
  assert.equal(estimate([], [[{ cardId: "lr:s1" }]], [], true), newSentenceSec(0, SEC_PER_NEW_FAST));
});

test("session.js still exports every name it used to", () => {
  const names = ["dayKey", "addMinutes", "QUICK_CAP", "SEC_PER_REVIEW", "SEC_PER_NEW", "SEC_PER_NEW_FAST", "MIX_MIN_NEW", "MIX_BUDGET_SEC", "MIX_OUTSIDE",
    "COLD_START_SEEN", "newSentenceSec", "cardKeys", "spaceOut", "nextDayStart", "FAST_TRACK_DAYS", "keepStarted", "markDifficult", "mixPlan", "learnPlan",
    "MEDIUM_LADDER_DAYS", "EASY_FACTOR", "ladderDays", "gradeFromResult", "claimForm", "unclaimForm", "dueCards", "dueCount", "interimNewSentences",
    "inFocus", "dueInFocus", "focusFirst", "burySiblings", "onePerFamily", "CHECK_GAP", "placeChecks", "checkBlanks", "buildSession", "composeReviews",
    "applyReview", "erMisses", "applyErReview", "applyParadigm", "applyCheck", "requeueWrong"];
  for (const n of names) assert.ok(n in barrel, n);
});
