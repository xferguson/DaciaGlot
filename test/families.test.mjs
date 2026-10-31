import { test } from "node:test";
import assert from "node:assert/strict";
import { findFamilies } from "../app/js/core/families.js";
import { buildSession, applyParadigm, onePerFamily, nextDayStart } from "../app/js/core/session.js";
import { pickNewSentences, siblingsOf } from "../app/js/core/select.js";
import { pickCarrier } from "../app/js/core/carrier.js";
import { paradigmRows } from "../app/js/ui/views/card-paradigm.js";
import { newCard } from "../app/js/core/fsrs.js";
import { makeContent, state, NOW } from "./helpers/mini-content.mjs";

const tok = (t, lex, form, extra = {}) => ({ t, units: [{ lex, form }], ...extra });
const sent = (id, ro, tokens, en = "x") => ({
  id, ro, en, level: "A1", stage: 1, situations: ["x"], register: "neutral", patterns: [], tokens,
});
const IN = tok("în", "in", "base");
const CLUJ = tok("Cluj.", "cluj", "base");
const s1 = sent("s1", "El locuiește în Cluj.", [tok("El", "el", "base"), tok("locuiește", "locui", "pres3sg", { cloze: true }), IN, CLUJ]);
const s2 = sent("s2", "Locuiești în Cluj.", [tok("Locuiești", "locui", "pres2sg", { cloze: true }), IN, CLUJ]);
const s3 = sent("s3", "Locuiesc în Cluj.", [tok("Locuiesc", "locui", "pres1sg", { cloze: true }), IN, CLUJ]);
const other = sent("s4", "Muncesc în Cluj.", [tok("Muncesc", "munci", "pres1sg", { cloze: true }), IN, CLUJ]);
const lexemes = [
  { id: "el", lemma: "el", pos: "pron", gloss: "he", forms: { base: "el" } },
  { id: "locui", lemma: "a locui", pos: "verb", gloss: "live", forms: { pres3sg: "locuiește", pres2sg: "locuiești", pres1sg: "locuiesc" }, keyForms: [] },
  { id: "munci", lemma: "a munci", pos: "verb", gloss: "work", forms: { pres1sg: "muncesc" } },
  { id: "in", lemma: "în", pos: "prep", gloss: "in", forms: { base: "în" } },
  { id: "cluj", lemma: "Cluj", pos: "noun", gloss: "Cluj", forms: { base: "Cluj" } },
];
const content = makeContent([s1, s2, s3, other], lexemes, []);

test("detection groups the locui sentences, ignoring the subject pronoun, and leaves a different lexeme out", () => {
  assert.deepEqual([...findFamilies(content.sentences.values())], [["s1", ["s1", "s2", "s3"]]]);
  assert.equal(content.familyOf.get("s2"), "s1");
  assert.equal(content.familyOf.has("s4"), false);
});

test("families are capped at 6 members", () => {
  const many = Array.from({ length: 8 }, (_, i) => sent(`m${i}`, "x", [tok(`f${i}`, "locui", `f${i}`)]));
  assert.equal([...findFamilies(many).values()][0].length, 6);
});

test("selection brings siblings with a sentence; they are not picked again as separate sentences", () => {
  const st = state();
  assert.deepEqual(siblingsOf("s1", { state: st, content }), ["s2", "s3"]);
  st.seenSentences.s2 = NOW;
  assert.deepEqual(siblingsOf("s1", { state: st, content }), ["s3"]);
  const fresh = state();
  const r = pickNewSentences(3, { focus: null, state: fresh, content, now: NOW, rng: () => 0 });
  assert.ok(r.sentences.filter((id) => ["s1", "s2", "s3"].includes(id)).length <= 1, "one pick per family");
});

test("a new family is one paradigm card plus one immediate check; the rest are due tomorrow", () => {
  const { queue } = buildSession({ mode: "learn", state: state(), content, now: NOW, rng: () => 0, newSentenceIds: ["s1"] });
  const pg = queue.find((q) => q.cardId.startsWith("pg:"));
  assert.deepEqual(pg.members, ["s1", "s2", "s3"]);
  assert.equal(queue.filter((q) => q.cardId.startsWith("lr:")).length, 0, "the paradigm replaces the lr cards");
  const checks = queue.filter((q) => q.check);
  assert.deepEqual(checks.map((q) => q.cardId), ["fm:locui:pres3sg"], "rng 0 → first member");
  assert.deepEqual([...pg.deferred].sort(), ["fm:locui:pres1sg", "fm:locui:pres2sg"]);
  assert.ok(queue.indexOf(pg) < queue.indexOf(checks[0]));

  const out = applyParadigm(state(), pg, NOW, content);
  for (const m of ["s1", "s2", "s3"]) assert.ok(m in out.seenSentences, `${m} seen`);
  assert.equal(out.cards["fm:locui:pres2sg"].due, nextDayStart(NOW));
  assert.equal("fm:locui:pres3sg" in out.cards, false, "the checked form is created by its check");
  assert.equal(out.history[Object.keys(out.history)[0]].cards, 1, "counts as one card");
});

function seenAll() {
  const st = state();
  for (const id of ["s1", "s2", "s3"]) st.seenSentences[id] = NOW - 1000;
  return st;
}

test("at most one due fm per family per session", () => {
  const due = ["fm:locui:pres3sg", "fm:locui:pres2sg", "fm:locui:pres1sg", "fm:munci:pres1sg"];
  const kept = onePerFamily(due, content, () => 0.5);
  assert.equal(kept.filter((id) => id.startsWith("fm:locui")).length, 1);
  assert.ok(kept.includes("fm:munci:pres1sg"));

  const st = seenAll();
  for (const id of due.slice(0, 3)) st.cards[id] = { ...newCard(NOW - 5 * 86400000), due: NOW - 1000 };
  const { queue } = buildSession({ mode: "review", state: st, content, now: NOW, rng: Math.random });
  assert.equal(queue.filter((q) => q.cardId.startsWith("fm:locui")).length, 1);
});

test("the carrier for a family form is a family member, even when another sentence carries it", () => {
  const extra = sent("s5", "Eu locuiesc aici.", [tok("Eu", "eu", "base"), tok("locuiesc", "locui", "pres1sg", { cloze: true }), tok("aici.", "aici", "base")]);
  const c2 = makeContent([s1, s2, s3, other, extra], lexemes, []);
  const st = seenAll();
  st.seenSentences.s5 = NOW - 10_000_000; // the older one would win on "longest unused"
  for (let i = 0; i < 10; i++) {
    const c = pickCarrier("locui.pres1sg", st, c2, { now: NOW, rng: Math.random, recent: 0 });
    assert.equal(c.sentenceId, "s3");
  }
});

test("paradigmRows highlights the differing word with its label", () => {
  const rows = paradigmRows(["s1", "s2", "s3"], content);
  assert.deepEqual(rows.map((r) => r.token), ["locuiește", "Locuiești", "Locuiesc"]);
  assert.equal(rows[0].label, "el/ea · prezent");
});
