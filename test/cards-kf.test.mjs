import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORM_LABELS, labelFor, isUnlocked, kfUnlockedFor, newKfCards, exampleSentenceFor, KF_PER_LEXEME,
} from "../app/js/core/cards.js";
import { unitsRequiredForCard } from "../app/js/core/units.js";
import { buildSession, applyReview } from "../app/js/core/session.js";
import { newCard } from "../app/js/core/fsrs.js";
import { makeContent, sentence, state, NOW } from "./helpers/mini-content.mjs";
import { readFileSync } from "node:fs";

const verb = {
  id: "gasi", lemma: "a găsi", pos: "verb", gloss: "to find", freq: 10,
  forms: { pres1sg: "găsesc", pres3sg: "găsește", ppl: "găsit", subj3: "să găsească", pres2sg: "găsești" },
  keyForms: ["pres1sg", "pres3sg", "ppl", "subj3", "pres2sg"],
};
const noun = { id: "casa", lemma: "casă", pos: "noun", gloss: "house", freq: 5, forms: { sg: "casă" }, keyForms: ["sg"] };
const s1 = sentence("s1", "găsesc casă", [{ lex: "gasi", form: "pres1sg" }, { lex: "casa", form: "sg" }]);
const s2 = sentence("s2", "găsește casă", [{ lex: "gasi", form: "pres3sg" }, { lex: "casa", form: "sg" }]);
const content = makeContent([s1, s2], [verb, noun]);

const met = (ids) => {
  const st = state();
  st.lexemeSentences = { gasi: ids, casa: ids };
  for (const id of ids) st.seenSentences[id] = NOW;
  return st;
};

test("unlock needs the lexeme met in two sentences", () => {
  assert.equal(kfUnlockedFor("gasi", met(["s1"])), false);
  assert.equal(isUnlocked("kf:gasi:pres1sg", met(["s1"]), content), false);
  assert.equal(isUnlocked("kf:gasi:pres1sg", met(["s1", "s2"]), content), true);
  assert.equal(isUnlocked("kf:gasi:inf", met(["s1", "s2"]), content), false); // not a key form
  assert.equal(isUnlocked("kf:nope:x", met(["s1", "s2"]), content), false);
});

test("per-lexeme cap and keyForms order", () => {
  const ids = newKfCards(met(["s1", "s2"]), content, { cap: 99 });
  assert.deepEqual(ids.filter((i) => i.startsWith("kf:gasi")),
    ["kf:gasi:pres1sg", "kf:gasi:pres3sg", "kf:gasi:ppl"]);
  assert.equal(KF_PER_LEXEME, 3);
  // already-introduced forms are skipped, so the next forms follow
  const st = met(["s1", "s2"]);
  st.cards["kf:gasi:pres1sg"] = newCard(NOW);
  assert.deepEqual(newKfCards(st, content, { cap: 99 }).filter((i) => i.startsWith("kf:gasi")),
    ["kf:gasi:pres3sg", "kf:gasi:ppl", "kf:gasi:subj3"]);
});

test("session cap and frequency ordering", () => {
  assert.deepEqual(newKfCards(met(["s1", "s2"]), content, { cap: 2 }), ["kf:casa:sg", "kf:gasi:pres1sg"]);
});

test("session includes kf cards after a verb met in 2 sentences; quick does not", () => {
  const st = met(["s1", "s2"]);
  const { queue } = buildSession({ mode: "session", state: st, content, now: NOW, rng: Math.random, newSentenceIds: [] });
  assert.ok(queue.some((q) => q.cardId === "kf:gasi:pres1sg" && q.isNew));
  const q2 = buildSession({ mode: "quick", state: st, content, now: NOW, rng: Math.random });
  assert.equal(q2.queue.length, 0);
});

test("attempts record <lex>.<form>", () => {
  assert.deepEqual(unitsRequiredForCard("kf:gasi:pres3sg", content), [{ u: "gasi.pres3sg", lx: "gasi" }]);
  const st = applyReview(met(["s1", "s2"]), "kf:gasi:pres3sg", 3, unitsRequiredForCard("kf:gasi:pres3sg", content), NOW, content);
  assert.equal(st.attempts.at(-1).u, "gasi.pres3sg");
  assert.equal(st.attempts.at(-1).lx, "gasi");
});

test("example sentence comes from seen sentences containing the exact form", () => {
  assert.equal(exampleSentenceFor("gasi", "pres3sg", met(["s1", "s2"]), content).id, "s2");
  assert.equal(exampleSentenceFor("gasi", "ppl", met(["s1", "s2"]), content), null);
  const st = met(["s1", "s2"]);
  delete st.seenSentences.s2;
  assert.equal(exampleSentenceFor("gasi", "pres3sg", st, content), null);
});

test("label map covers every key form used in content", () => {
  const lexemes = JSON.parse(readFileSync(new URL("../app/content/lexemes/core.json", import.meta.url), "utf8"));
  for (const l of Array.isArray(lexemes) ? lexemes : lexemes.lexemes) {
    for (const f of l.keyForms ?? []) assert.ok(FORM_LABELS[f], `${l.id}.${f}`);
  }
  assert.equal(labelFor("pres1sg"), "eu · prezent");
  assert.equal(labelFor("ppl"), "participiu (am …)");
  assert.equal(labelFor("subj3"), "el/ea · să …");
  assert.equal(labelFor("sgDef"), "the … (sg.)");
  assert.equal(labelFor("sgGenDat"), "of/to the … (sg.)");
});
