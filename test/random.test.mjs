// Q06: shared randomness helpers. The call-site tests pin each caller's output for a fixed seed, so moving the
// hand-written `rng()` maths into core/random.js can't shift seeded tests or saved behavior.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shuffle, pickIndex, pickOne } from "../app/js/core/random.js";
import { shuffle as lrShuffle } from "../app/js/ui/components/cards/card-lr.js";
import { pickDistractors } from "../app/js/ui/models/card-lr.js";
import { tileOptions } from "../app/js/core/cards.js";
import { buildSession, onePerFamily, requeueWrong } from "../app/js/core/session.js";
import { pickNewSentences } from "../app/js/core/select.js";
import { pickCarrier, pickComposite } from "../app/js/core/carrier.js";
import { review } from "../app/js/core/fsrs.js";
import { makeContent, sentence, state, NOW } from "./helpers/mini-content.mjs";

/** Deterministic rng (mulberry32) that also counts its calls. */
function seeded(seed) {
  let a = seed >>> 0;
  const rng = () => {
    rng.calls++;
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  rng.calls = 0;
  return rng;
}
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };
const DAY = 86400000;
const SEEDS = [1, 99, 1234, 777777, 31337];

// --- the helpers ---

test("pickIndex: floor(rng * n), clamped to n - 1, one rng call", () => {
  assert.equal(pickIndex(() => 0, 5), 0);
  assert.equal(pickIndex(() => 0.5, 5), 2);
  assert.equal(pickIndex(() => 0.999999, 5), 4);
  assert.equal(pickIndex(() => 1, 5), 4, "an rng that returns 1 still gives a valid index");
  const r = seeded(1);
  pickIndex(r, 7);
  assert.equal(r.calls, 1);
});

test("pickOne: the element at pickIndex", () => {
  assert.equal(pickOne(["a", "b", "c"], () => 0), "a");
  assert.equal(pickOne(["a", "b", "c"], () => 0.5), "b");
  assert.equal(pickOne(["a", "b", "c"], () => 0.99), "c");
});

test("shuffle: Fisher–Yates on a copy, n - 1 rng calls, a permutation", () => {
  const src = [1, 2, 3, 4, 5, 6];
  const r = seeded(7);
  const out = shuffle(src, r);
  assert.deepEqual(src, [1, 2, 3, 4, 5, 6], "input not mutated");
  assert.notEqual(out, src);
  assert.deepEqual([...out].sort(), src);
  assert.equal(r.calls, 5);
  assert.deepEqual(shuffle([1, 2, 3, 4], () => 0), [2, 3, 4, 1]);
  assert.deepEqual(shuffle([], () => 0), []);
});

test("rng is required", () => {
  assert.throws(() => pickIndex(undefined, 3), TypeError);
  assert.throws(() => shuffle([1, 2], undefined), TypeError);
  assert.throws(() => pickOne([1], undefined), TypeError);
});

// --- each call site, fixed seed → today's result ---

test("card-lr re-exports the core shuffle", () => {
  assert.equal(lrShuffle, shuffle);
});

test("call site: card-lr pickDistractors", () => {
  const list = Array.from({ length: 8 }, (_, i) => sentence(`d${i}`, `w${i} common`, [{ lex: `w${i}`, form: "base" }, { lex: "common", form: "base" }]));
  const content = makeContent(list);
  const r = seeded(42);
  const ids = pickDistractors(list[0], content, r).map((s) => s.id);
  assert.deepEqual([ids, r.calls], RECORD.lr);
});

const tok = (t, units, extra = {}) => ({ t, units, ...extra });
const s1 = {
  id: "s1", ro: "Am o problemă.", en: "I have a problem.", level: "A1", stage: 1, situations: ["x"],
  register: "neutral", patterns: [],
  tokens: [
    tok("Am", [{ lex: "avea", form: "pres1sg" }], { cloze: true }),
    tok("o", [{ lex: "un", form: "f" }]),
    tok("problemă.", [{ lex: "problema", form: "sg" }], { cloze: true }),
  ],
};
const tileContent = makeContent([s1], [
  { id: "avea", lemma: "a avea", pos: "verb", gloss: "have", forms: { pres1sg: "am", pres2sg: "ai", pres3sg: "are", pres1pl: "avem", pres3pl: "au" } },
  { id: "un", lemma: "un", pos: "det", gloss: "a", forms: { f: "o", m: "un" } },
  { id: "problema", lemma: "problemă", pos: "noun", gloss: "problem", forms: { sg: "problemă", pl: "probleme", def: "problema" } },
]);

test("call site: cards tileOptions", () => {
  const out = SEEDS.slice(0, 3).map((seed) => { const r = seeded(seed); return [tileOptions(s1, tileContent, r), r.calls]; });
  assert.deepEqual(out, RECORD.tiles);
});

const ftok = (t, lex, form, extra = {}) => ({ t, units: [{ lex, form }], ...extra });
const fsent = (id, ro, tokens) => ({ id, ro, en: "x", level: "A1", stage: 1, situations: ["x"], register: "neutral", patterns: [], tokens });
const IN = ftok("în", "in", "base");
const CLUJ = ftok("Cluj.", "cluj", "base");
const famContent = makeContent([
  fsent("s1", "El locuiește în Cluj.", [ftok("El", "el", "base"), ftok("locuiește", "locui", "pres3sg", { cloze: true }), IN, CLUJ]),
  fsent("s2", "Locuiești în Cluj.", [ftok("Locuiești", "locui", "pres2sg", { cloze: true }), IN, CLUJ]),
  fsent("s3", "Locuiesc în Cluj.", [ftok("Locuiesc", "locui", "pres1sg", { cloze: true }), IN, CLUJ]),
  fsent("s4", "Muncesc în Cluj.", [ftok("Muncesc", "munci", "pres1sg", { cloze: true }), IN, CLUJ]),
], [
  { id: "el", lemma: "el", pos: "pron", gloss: "he", forms: { base: "el" } },
  { id: "locui", lemma: "a locui", pos: "verb", gloss: "live", forms: { pres3sg: "locuiește", pres2sg: "locuiești", pres1sg: "locuiesc" }, keyForms: [] },
  { id: "munci", lemma: "a munci", pos: "verb", gloss: "work", forms: { pres1sg: "muncesc" } },
  { id: "in", lemma: "în", pos: "prep", gloss: "in", forms: { base: "în" } },
  { id: "cluj", lemma: "Cluj", pos: "noun", gloss: "Cluj", forms: { base: "Cluj" } },
], []);

test("call site: session onePerFamily", () => {
  const due = ["fm:locui:pres3sg", "fm:locui:pres2sg", "fm:locui:pres1sg", "fm:munci:pres1sg"];
  const out = SEEDS.map((seed) => { const r = seeded(seed); return [onePerFamily(due, famContent, r), r.calls]; });
  assert.deepEqual(out, RECORD.family);
});

test("call site: session paradigm check member", () => {
  const out = SEEDS.map((seed) => {
    const r = seeded(seed);
    const { queue } = buildSession({ mode: "learn", state: state(), content: famContent, now: NOW, rng: r, newSentenceIds: ["s1"] });
    return [queue.filter((q) => q.check).map((q) => q.cardId), r.calls];
  });
  assert.deepEqual(out, RECORD.paradigm);
});

test("call site: session requeueWrong", () => {
  const out = SEEDS.map((seed) => {
    const r = seeded(seed);
    const queue = Array.from({ length: 10 }, (_, i) => ({ cardId: `lr:q${i}` }));
    return [requeueWrong(queue, 1, queue[1], r).at, r.calls];
  });
  assert.deepEqual(out, RECORD.requeue);
});

test("call site: select pickNewSentences band shuffle", () => {
  const u = (lex) => ({ lex, form: "base" });
  const content = makeContent(Array.from({ length: 12 }, (_, i) =>
    sentence(`n${String(i).padStart(2, "0")}`, `a${i} b${i}`, [u(`a${i}`), u(`b${i}`)])));
  const out = SEEDS.slice(0, 3).map((seed) => {
    const r = seeded(seed);
    return [pickNewSentences(4, { focus: null, state: state(), content, now: NOW, rng: r }).sentences, r.calls];
  });
  assert.deepEqual(out, RECORD.select);
});

test("call site: fsrs fuzz", () => {
  const base = { due: NOW, stability: 50, difficulty: 5, reps: 5, lapses: 0, state: 2, step: 0, lastReview: NOW - 50 * DAY };
  const out = SEEDS.map((seed) => { const r = seeded(seed); return [(review(base, 3, NOW, { fuzz: true, rng: r }).due - NOW) / DAY, r.calls]; });
  assert.deepEqual(out, RECORD.fuzz);
});

test("call site: carrier pickCarrier and pickComposite", () => {
  const FI = { lex: "fi", form: "pres3sg" };
  const mk = (id, extra = []) => ({
    id, ro: id, en: id, level: "A1", stage: 1, situations: ["x"], patterns: [], register: "neutral",
    tokens: [tok("este", [FI], { cloze: true }), ...extra],
  });
  const other = (lex) => tok(lex, [{ lex, form: "base" }]);
  const content = makeContent([mk("a", [other("x")]), mk("b", [other("x")]), mk("c", [other("x")]), mk("d", [other("x")])], [
    { id: "fi", lemma: "a fi", pos: "verb", gloss: "be", forms: { pres3sg: "este" }, keyForms: ["pres3sg"] },
    { id: "x", lemma: "x", pos: "noun", gloss: "x", forms: { base: "x" } },
  ]);
  const st = state();
  for (const id of ["a", "b", "c", "d"]) st.seenSentences[id] = NOW - 100;
  const carriers = SEEDS.map((seed) => { const r = seeded(seed); return [pickCarrier("fi.pres3sg", st, content, { now: NOW, rng: r }).sentenceId, r.calls]; });
  const csent = (id, lexes) => ({
    id, ro: lexes.join(" "), en: `EN ${id}`, level: "A1", stage: 1, situations: ["x"], patterns: [], register: "neutral",
    tokens: lexes.map((l) => tok(l, [{ lex: l, form: "base" }], { cloze: true })),
  });
  const ccontent = makeContent(["p", "q", "r", "s"].map((id) => csent(id, ["a", "b"])),
    ["a", "b"].map((id) => ({ id, lemma: id, pos: "noun", gloss: id, forms: { base: id } })));
  const cst = state();
  for (const id of ["p", "q", "r", "s"]) cst.seenSentences[id] = NOW - 10 * DAY;
  for (const l of ["a", "b"]) cst.attempts.push({ u: `${l}.base`, lx: l, c: 1, t: NOW - 30 * DAY, card: "fm:" + l });
  const comps = SEEDS.map((seed) => { const r = seeded(seed); return [pickComposite(["a.base", "b.base"], cst, ccontent, NOW, r)?.sentenceId, r.calls]; });
  assert.deepEqual([carriers, comps], RECORD.carrier);
});

// Recorded from the hand-written code before Q06 moved it into core/random.js.
const RECORD = {
  lr: [["d4", "d2", "d1"], 6],
  tiles: [[["problema", "am", "o", "avem", "problemă", "are"], 12], [["are", "un", "problemă", "o", "am"], 11], [["problemă", "are", "am", "o", "avem"], 11]],
  family: [[["fm:locui:pres2sg", "fm:munci:pres1sg"], 1], [["fm:locui:pres3sg", "fm:munci:pres1sg"], 1], [["fm:locui:pres3sg", "fm:munci:pres1sg"], 1], [["fm:locui:pres1sg", "fm:munci:pres1sg"], 1], [["fm:locui:pres1sg", "fm:munci:pres1sg"], 1]],
  paradigm: [[["fm:locui:pres2sg"], 1], [["fm:locui:pres3sg"], 1], [["fm:locui:pres3sg"], 1], [["fm:locui:pres1sg"], 1], [["fm:locui:pres1sg"], 1]],
  requeue: [[5, 1], [4, 1], [4, 1], [6, 1], [6, 1]],
  select: [[["n04", "n10", "n02", "n06"], 11], [["n11", "n04", "n02", "n01"], 11], [["n02", "n03", "n05", "n01"], 11]],
  fuzz: [[147, 1], [140, 1], [137, 1], [150, 1], [149, 1]],
  carrier: [[["c", 1], ["b", 1], ["a", 1], ["d", 1], ["c", 1]], [["r", 1], ["q", 1], ["p", 1], ["s", 1], ["r", 1]]],
};
