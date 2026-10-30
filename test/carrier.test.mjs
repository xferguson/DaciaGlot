import { test } from "node:test";
import assert from "node:assert/strict";
import { carriersFor, pickCarrier, resolveFm } from "../app/js/core/carrier.js";
import { makeContent, state, NOW } from "./helpers/mini-content.mjs";

const tok = (t, units, extra = {}) => ({ t, units, ...extra });
const FI = { lex: "fi", form: "pres3sg" };
const mk = (id, extraTokens = []) => ({
  id, ro: id, en: id, level: "A1", stage: 1, situations: ["x"], patterns: [], register: "neutral",
  tokens: [tok("este", [FI], { cloze: true }), ...extraTokens],
});
const other = (lex) => tok(lex, [{ lex, form: "base" }]);
const lexemes = [
  { id: "fi", lemma: "a fi", pos: "verb", gloss: "be", forms: { pres3sg: "este", inf: "a fi" }, keyForms: ["pres3sg"] },
  { id: "x", lemma: "x", pos: "noun", gloss: "x", forms: { base: "x" } },
  { id: "y", lemma: "y", pos: "noun", gloss: "y", forms: { base: "y" } },
];
const sentences = [mk("a", [other("x")]), mk("b", [other("y")]), mk("c"), mk("d", [other("x"), other("y")])];
const content = makeContent(sentences, lexemes);
const U = "fi.pres3sg";

const seenAll = (ids = ["a", "b", "c", "d"]) => {
  const st = state();
  ids.forEach((id, i) => { st.seenSentences[id] = NOW - 100 * (i + 1); });
  return st;
};
const attempt = (sid, t) => ({ u: U, lx: "fi", c: 1, t, card: `cz:${sid}:0` });

test("no seen carrier → null", () => {
  assert.deepEqual(carriersFor(U, state(), content), []);
  assert.equal(pickCarrier(U, state(), content, { now: NOW }), null);
});

test("only seen sentences carry; a non-cloze token counts when the unit is its only unit", () => {
  const s = { ...mk("e"), tokens: [tok("este", [FI, { lex: "x", form: "base" }]), other("y")] };
  const c = makeContent([s, ...sentences], lexemes);
  const st = seenAll(["a", "e"]);
  assert.deepEqual(carriersFor(U, st, c).map((x) => x.sentenceId).sort(), ["a"], "multi-unit non-cloze token cannot be blanked");
  s.tokens[0].units = [FI];
  assert.deepEqual(carriersFor(U, st, c).map((x) => x.sentenceId).sort(), ["a", "e"]);
});

test("prefers the fewest unknown other units", () => {
  const st = seenAll();
  // a: unknown x; b: unknown y; c: nothing else; d: x and y
  assert.equal(pickCarrier(U, st, content, { now: NOW, rng: () => 0 }).sentenceId, "c");
});

test("then the longest since the sentence was last used", () => {
  const st = seenAll(["a", "b"]);
  st.attempts.push({ u: "x.base", lx: "x", c: 1, t: NOW - 10, card: "cz:a:1" }); // x known → a and b tie on unknown? b has unknown y
  st.attempts.push({ u: "y.base", lx: "y", c: 1, t: NOW - 5, card: "cz:b:1" });
  st.attempts.push({ u: "x.base", lx: "x", c: 1, t: NOW - 2, card: "cz:a:1" }); // a used more recently than b
  assert.equal(pickCarrier(U, st, content, { now: NOW, rng: () => 0 }).sentenceId, "b");
});

test("rotates: never one of the last 3 attempts' carriers while another exists", () => {
  const st = seenAll();
  st.attempts.push(attempt("c", NOW - 3000), attempt("a", NOW - 2000), attempt("b", NOW - 1000));
  const c = pickCarrier(U, st, content, { now: NOW, rng: () => 0 });
  assert.equal(c.sentenceId, "d");
  st.attempts.push(attempt("d", NOW - 500));
  // last three are now a, b, d → c is free again
  assert.equal(pickCarrier(U, st, content, { now: NOW, rng: () => 0 }).sentenceId, "c");
  for (let i = 0; i < 20; i++) {
    const r = pickCarrier(U, st, content, { now: NOW, rng: () => i / 20 });
    assert.ok(!["a", "b", "d"].includes(r.sentenceId));
  }
});

test("honours exclude; with every candidate recent or excluded → null, and resolveFm falls back", () => {
  const st = seenAll(["a", "b"]);
  assert.equal(pickCarrier(U, st, content, { now: NOW, exclude: new Set(["a"]) }).sentenceId, "b");
  assert.equal(pickCarrier(U, st, content, { now: NOW, exclude: new Set(["a", "b"]) }), null);
  // key-form label exists → drill
  assert.deepEqual(resolveFm("fm:fi:pres3sg", st, content, { now: NOW, exclude: new Set(["a", "b"]) }),
    { type: "kf", presentedId: "kf:fi:pres3sg" });
  // no label for the form → the least recent carrier despite exclude
  st.attempts.push({ u: "fi.inf", lx: "fi", c: 1, t: NOW - 9, card: "cz:a:0" });
  const noLabel = makeContent([{ ...mk("a"), tokens: [tok("a fi", [{ lex: "fi", form: "inf" }], { cloze: true })] }], lexemes);
  const r = resolveFm("fm:fi:inf", st, noLabel, { now: NOW, exclude: new Set(["a"]) });
  assert.deepEqual(r, { type: "cz", presentedId: "cz:a:0", sentenceId: "a", tokenIndex: 0 });
});

test("resolveFm: cloze in a seen sentence; prefer wins; no carrier and no label → null; no carrier with label → kf drill", () => {
  const st = seenAll();
  const r = resolveFm("fm:fi:pres3sg", st, content, { now: NOW, rng: () => 0 });
  assert.equal(r.type, "cz");
  assert.equal(r.presentedId, `cz:${r.sentenceId}:${r.tokenIndex}`);
  assert.equal(resolveFm("fm:fi:pres3sg", st, content, { now: NOW, prefer: "b" }).sentenceId, "b");
  assert.deepEqual(resolveFm("fm:fi:pres3sg", state(), content, { now: NOW }), { type: "kf", presentedId: "kf:fi:pres3sg" });
  assert.equal(resolveFm("fm:fi:inf", state(), content, { now: NOW }), null);
});
