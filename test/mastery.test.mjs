import { test } from "node:test";
import assert from "node:assert/strict";
import { patternState, allPatternStates, unitState, sentenceMastered, compactAttempts } from "../app/js/core/mastery.js";
import { NOW, makeContent, sentence, state as freshState } from "./helpers/mini-content.mjs";

const DAY = 86400000;
const U = (lex, form = "x") => ({ lex, form });
const s1 = sentence("s1", "aa bb", [{ ...U("a"), pattern: "p" }, U("b")], { patterns: ["p"] });
const s2 = sentence("s2", "cc dd", [U("c"), U("d")], { patterns: ["p"] });
const content = makeContent([s1, s2], [], [{ id: "p", stage: 1, level: "A1", minLexemesForProducing: 5 }]);

function st(extra = {}) {
  return { ...freshState(), seenSentences: { s1: NOW - DAY }, ...extra };
}
const att = (u, lx, c, t = NOW - DAY, card = "cz:s1:0") => ({ u, lx, c, t, card });
/** `k` correct attempts across `k` distinct lexemes, then `wrong` wrong ones. */
const patAttempts = (k, wrong = 0) => [
  ...Array.from({ length: k }, (_, i) => att("pat:p", `l${i}`, 1, NOW - DAY + i)),
  ...Array.from({ length: wrong }, (_, i) => att("pat:p", "l0", 0, NOW - DAY + 100 + i)),
];
const card = (stability, extra = {}) => ({ due: NOW, stability, difficulty: 5, reps: 3, lapses: 0, state: 2, step: 0, lastReview: NOW - DAY, ...extra });

test("patternState: not-started / seen", () => {
  assert.equal(patternState("p", freshState(), content, NOW), "not-started");
  assert.equal(patternState("p", st(), content, NOW), "seen");
});

test("patternState: producing boundaries (lexemes, accuracy)", () => {
  const table = [
    ["4 lexemes, 100%", patAttempts(4), "seen"],
    ["5 lexemes, 100%", patAttempts(5), "producing"],
    // 5 distinct correct + 2 wrong = 5/7 = 71%
    ["5 lexemes, 71%", patAttempts(5, 2), "producing"],
    // 5 distinct correct + 3 wrong = 5/8 = 62.5%
    ["5 lexemes, 62.5%", patAttempts(5, 3), "seen"],
  ];
  for (const [name, attempts, want] of table) assert.equal(patternState("p", st({ attempts }), content, NOW), want, name);
});

test("patternState: exactly 70% producing, just below is not", () => {
  // 20-window: 14 correct of 20 = 70%; 13 of 20 = 65%.
  const mk = (right) => [
    ...Array.from({ length: right }, (_, i) => att("pat:p", `l${i % 6}`, 1, NOW - 5 * DAY + i)),
    ...Array.from({ length: 20 - right }, (_, i) => att("pat:p", "l0", 0, NOW - 4 * DAY + i)),
  ];
  assert.equal(patternState("p", st({ attempts: mk(14) }), content, NOW), "producing");
  assert.equal(patternState("p", st({ attempts: mk(13) }), content, NOW), "seen");
});

test("patternState: only the last 20 attempts count", () => {
  const early = Array.from({ length: 10 }, (_, i) => att("pat:p", `l${i}`, 0, NOW - 10 * DAY + i));
  const late = Array.from({ length: 20 }, (_, i) => att("pat:p", `l${i % 6}`, 1, NOW - DAY + i));
  assert.equal(patternState("p", st({ attempts: [...early, ...late] }), content, NOW), "producing");
});

test("patternState: automatic needs 90%, 10 lexemes and a stable card", () => {
  const good = patAttempts(10);
  const cards = { "cz:s1:0": card(21) };
  assert.equal(patternState("p", st({ attempts: good, cards }), content, NOW), "automatic");
  assert.equal(patternState("p", st({ attempts: patAttempts(9), cards }), content, NOW), "producing", "9 lexemes");
  assert.equal(patternState("p", st({ attempts: good, cards: { "cz:s1:0": card(20.9) } }), content, NOW), "producing", "stability 20.9");
  assert.equal(patternState("p", st({ attempts: good }), content, NOW), "producing", "no card");
  // 10 correct + 1 wrong = 90.9%; + 2 wrong = 83%.
  assert.equal(patternState("p", st({ attempts: patAttempts(10, 1), cards }), content, NOW), "automatic");
  assert.equal(patternState("p", st({ attempts: patAttempts(10, 2), cards }), content, NOW), "producing");
});

test("patternState: aggregates count toward lexemes and accuracy", () => {
  const unitAggregates = { "pat:p": { n: 30, correct: 30, lexemes: ["a", "b", "c", "d", "e"], lastCorrectAt: NOW - 100 * DAY } };
  assert.equal(patternState("p", st({ unitAggregates }), content, NOW), "producing");
  // Aggregate ratio 60% fills the window when no raw attempts remain.
  const poor = { "pat:p": { n: 30, correct: 18, lexemes: ["a", "b", "c", "d", "e"], lastCorrectAt: 1 } };
  assert.equal(patternState("p", st({ unitAggregates: poor }), content, NOW), "seen");
});

test("allPatternStates covers every pattern", () => {
  assert.deepEqual(allPatternStates(st(), content, NOW), { p: "seen" });
});

test("unitState", () => {
  assert.equal(unitState("a.x", freshState(), content, NOW), "unseen");
  assert.equal(unitState("a.x", st(), content, NOW), "seen");
  assert.equal(unitState("c.x", st(), content, NOW), "unseen", "sentence s2 not introduced");
  assert.equal(unitState("a.x", st({ attempts: [att("a.x", "a", 0)] }), content, NOW), "seen");
  const ok = st({ attempts: [att("a.x", "a", 1)] });
  assert.equal(unitState("a.x", ok, content, NOW), "produced");
  const stable = { ...ok, cards: { "cz:s1:0": card(21) } };
  assert.equal(unitState("a.x", stable, content, NOW), "stable");
  assert.equal(unitState("a.x", { ...stable, cards: { "cz:s1:0": card(20) } }, content, NOW), "produced");
  const lastWrong = { ...stable, attempts: [att("a.x", "a", 1), att("a.x", "a", 0, NOW - 1000)] };
  assert.equal(unitState("a.x", lastWrong, content, NOW), "produced");
  const agg = st({ unitAggregates: { "a.x": { n: 1, correct: 1, lexemes: ["a"], lastCorrectAt: 1 } } });
  assert.equal(unitState("a.x", agg, content, NOW), "produced");
});

test("sentenceMastered", () => {
  const withCard = (c, attempts = [att("a.x", "a", 1, NOW - DAY, "cz:s1:0")]) => st({ cards: { "cz:s1:0": c }, attempts });
  assert.equal(sentenceMastered("s1", withCard(card(7)), content, NOW), true);
  assert.equal(sentenceMastered("s1", withCard(card(6.9)), content, NOW), false);
  assert.equal(sentenceMastered("s1", withCard(card(7), [att("a.x", "a", 0, NOW - DAY, "cz:s1:0")]), content, NOW), false);
  assert.equal(sentenceMastered("s2", withCard(card(30)), content, NOW), false, "other sentence");
  assert.equal(sentenceMastered("s1", st({ cards: { "lr:s1": card(30) } }), content, NOW), false, "lr is not production");
  // attempt folded away: fall back to the card's FSRS state
  assert.equal(sentenceMastered("s1", withCard(card(30), []), content, NOW), true);
  assert.equal(sentenceMastered("s1", withCard(card(30, { state: 3 }), []), content, NOW), false);
});

test("compactAttempts: folds only attempts older than 90 days, keeps counts", () => {
  const old = [
    att("a.x", "a", 1, NOW - 100 * DAY), att("a.x", "b", 1, NOW - 95 * DAY), att("a.x", "b", 0, NOW - 91 * DAY),
    att("pat:p", "a", 1, NOW - 92 * DAY),
  ];
  const fresh = [att("a.x", "c", 1, NOW - 89 * DAY), att("a.x", "d", 0, NOW - DAY)];
  const s = st({ attempts: [...old, ...fresh] });
  const c = compactAttempts(s, NOW);
  assert.deepEqual(c.attempts, fresh);
  assert.equal(c.lastCompactionAt, NOW);
  assert.deepEqual(c.unitAggregates["a.x"], { n: 3, correct: 2, lexemes: ["a", "b"], lastCorrectAt: NOW - 95 * DAY });
  assert.equal(c.unitAggregates["pat:p"].n, 1);
  assert.equal(s.attempts.length, 6, "input not mutated");
  const total = (x) => x.attempts.length + Object.values(x.unitAggregates).reduce((n, a) => n + a.n, 0);
  assert.equal(total(c), total(s));
});

test("compactAttempts is idempotent and merges into existing aggregates", () => {
  const s = st({
    unitAggregates: { "a.x": { n: 5, correct: 4, lexemes: ["a", "z"], lastCorrectAt: NOW - 200 * DAY } },
    attempts: [att("a.x", "b", 1, NOW - 100 * DAY)],
  });
  const once = compactAttempts(s, NOW);
  assert.deepEqual(once.unitAggregates["a.x"], { n: 6, correct: 5, lexemes: ["a", "z", "b"], lastCorrectAt: NOW - 100 * DAY });
  assert.deepEqual(compactAttempts(once, NOW), once);
});

test("compaction caps aggregate lexemes at 50", () => {
  const attempts = Array.from({ length: 60 }, (_, i) => att("pat:p", `l${i}`, 1, NOW - 100 * DAY + i));
  const c = compactAttempts(st({ attempts }), NOW);
  assert.equal(c.unitAggregates["pat:p"].lexemes.length, 50);
  assert.equal(c.unitAggregates["pat:p"].n, 60);
});

test("derived states do not change across a compaction", () => {
  const attempts = [
    ...Array.from({ length: 12 }, (_, i) => att("pat:p", `l${i}`, i % 5 === 0 ? 0 : 1, NOW - 150 * DAY + i)),
    ...Array.from({ length: 8 }, (_, i) => att("pat:p", `m${i}`, 1, NOW - 30 * DAY + i)),
    att("a.x", "a", 1, NOW - 120 * DAY), att("b.x", "b", 0, NOW - 10 * DAY),
  ];
  const cards = { "cz:s1:0": card(25) };
  for (const base of [st({ attempts, cards }), st({ attempts: attempts.slice(0, 12), cards }), st({ attempts: attempts.slice(12), cards })]) {
    const after = compactAttempts(base, NOW);
    assert.deepEqual(allPatternStates(after, content, NOW), allPatternStates(base, content, NOW));
    for (const u of ["a.x", "b.x", "c.x"]) assert.equal(unitState(u, after, content, NOW), unitState(u, base, content, NOW));
    assert.equal(sentenceMastered("s1", after, content, NOW), sentenceMastered("s1", base, content, NOW));
  }
});

test("store.load() compacts old attempts at most once a day", async () => {
  const { installLocalStorage } = await import("./helpers/local-storage-shim.mjs");
  const { load, STATE_KEY, defaultState } = await import("../app/js/data/store.js");
  const ls = installLocalStorage();
  const real = Date.now;
  try {
    const t = real();
    const oldAttempt = att("a.x", "a", 1, t - 100 * DAY);
    const base = { ...defaultState(t - 200 * DAY), attempts: [oldAttempt] };
    ls.setItem(STATE_KEY, JSON.stringify(base));
    const first = load();
    assert.equal(first.attempts.length, 0);
    assert.equal(first.unitAggregates["a.x"].n, 1);
    assert.ok(first.lastCompactionAt >= t);
    // Compacted within the last day: another old attempt is left alone.
    ls.setItem(STATE_KEY, JSON.stringify({ ...first, attempts: [oldAttempt] }));
    assert.equal(load().attempts.length, 1);
    // A day later it runs again.
    ls.setItem(STATE_KEY, JSON.stringify({ ...first, lastCompactionAt: t - 2 * DAY, attempts: [oldAttempt] }));
    assert.equal(load().attempts.length, 0);
  } finally {
    Date.now = real;
  }
});
