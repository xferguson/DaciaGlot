import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCardId, buildCardId, cardsForSentence, isUnlocked } from "../app/js/core/cards.js";
import { makeContent, sentence, state, NOW } from "./helpers/mini-content.mjs";
import { newCard } from "../app/js/core/fsrs.js";
import { buildSession } from "../app/js/core/session.js";

const u = (lex) => ({ lex, form: "base" });
const s1 = sentence("s1", "unu doi", [u("a"), u("b")]);
const content = makeContent([s1]);

test("id round trip", () => {
  assert.deepEqual(parseCardId("cz:s1:2"), { type: "cz", sentenceId: "s1", tokenIndex: 2 });
  assert.deepEqual(parseCardId("lr:s1"), { type: "lr", sentenceId: "s1" });
  assert.deepEqual(parseCardId("kf:gasi:pres3sg"), { type: "kf", lexemeId: "gasi", formKey: "pres3sg" });
  assert.deepEqual(parseCardId("fm:fi:pres3sg"), { type: "fm", lexemeId: "fi", formKey: "pres3sg" });
  assert.equal(buildCardId("fm", "fi", "pres3sg"), "fm:fi:pres3sg");
  assert.equal(buildCardId("cz", "s1", 2), "cz:s1:2");
  assert.throws(() => parseCardId("zz:s1"));
  assert.throws(() => parseCardId("cz:s1:x"));
});

test("cardsForSentence: lr plus one fm per cloze unit without a card", () => {
  assert.deepEqual(cardsForSentence(s1, content), ["lr:s1", "fm:a:base"]);
  const st = state();
  assert.deepEqual(cardsForSentence(s1, content, st), ["lr:s1", "fm:a:base"]);
  st.cards["fm:a:base"] = newCard(NOW);
  assert.deepEqual(cardsForSentence(s1, content, st), ["lr:s1"]);
});

test("two sentences sharing a form produce one fm card", () => {
  const s2 = sentence("s2", "unu trei", [u("a"), u("c")]);
  const both = makeContent([s1, s2]);
  const ids = [s1, s2].flatMap((s) => cardsForSentence(s, both, state()));
  assert.equal(new Set(ids.filter((i) => i.startsWith("fm:"))).size, 1);
  const { queue } = buildSession({ mode: "learn", state: state(), content: both, now: NOW, rng: () => 0.5, newSentenceIds: ["s1", "s2"] });
  assert.deepEqual(queue.filter((q) => q.cardId.startsWith("fm:")).map((q) => q.cardId), ["fm:a:base"]);
  assert.equal(queue.find((q) => q.cardId === "fm:a:base").from, "s1");
});

test("isUnlocked: lr always, cz after lr exists, later types locked", () => {
  const st = state();
  assert.equal(isUnlocked("lr:s1", st, content), true);
  assert.equal(isUnlocked("cz:s1:0", st, content), false);
  st.cards["lr:s1"] = newCard(NOW);
  assert.equal(isUnlocked("cz:s1:0", st, content), true);
  assert.equal(isUnlocked("cz:s1:1", st, content), false); // not a cloze token
  assert.equal(isUnlocked("lr:missing", st, content), false);
  assert.equal(isUnlocked("er:s1", st, content), false);
});
