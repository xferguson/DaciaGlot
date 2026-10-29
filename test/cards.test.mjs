import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCardId, buildCardId, cardsForSentence, isUnlocked } from "../app/js/core/cards.js";
import { makeContent, sentence, state, NOW } from "./helpers/mini-content.mjs";
import { newCard } from "../app/js/core/fsrs.js";

const u = (lex) => ({ lex, form: "base" });
const s1 = sentence("s1", "unu doi", [u("a"), u("b")]);
const content = makeContent([s1]);

test("id round trip", () => {
  assert.deepEqual(parseCardId("cz:s1:2"), { type: "cz", sentenceId: "s1", tokenIndex: 2 });
  assert.deepEqual(parseCardId("lr:s1"), { type: "lr", sentenceId: "s1" });
  assert.deepEqual(parseCardId("kf:gasi:pres3sg"), { type: "kf", lexemeId: "gasi", formKey: "pres3sg" });
  assert.equal(buildCardId("cz", "s1", 2), "cz:s1:2");
  assert.throws(() => parseCardId("zz:s1"));
  assert.throws(() => parseCardId("cz:s1:x"));
});

test("cardsForSentence: lr plus one cz per cloze token", () => {
  assert.deepEqual(cardsForSentence(s1, content), ["lr:s1", "cz:s1:0"]);
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
