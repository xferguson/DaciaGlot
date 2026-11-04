import { test } from "node:test";
import assert from "node:assert/strict";
import { makeContent, sentence, state, NOW } from "./helpers/mini-content.mjs";
import { shownUnits, isPrimed, deferPrimed, PRIMED_CREDIT } from "../app/js/core/priming.js";
import { applyReview } from "../app/js/core/review.js";
import { unitsRequiredForCard } from "../app/js/core/units.js";
import { scheduleCard, partialCredit } from "../app/js/core/schedule.js";
import { newCard } from "../app/js/core/fsrs.js";
import { DAY_MS } from "../app/js/core/time.js";

const u = (lex) => ({ lex, form: "base" });
const sents = [
  sentence("s0", "a0 b0", [u("a0"), u("b0")]),
  sentence("s1", "a1 b1", [u("a1"), u("b1")]),
  sentence("s2", "a2 b2", [u("a2"), u("b2")]),
  sentence("s3", "a3 b0", [u("a3"), u("b0")]),
];
const lexemes = ["a0", "b0", "a1", "b1", "a2", "b2", "a3"].map((id) => ({ id, lemma: id, pos: "noun", gloss: "g", forms: { base: id } }));
const content = makeContent(sents, lexemes);
const cz = (i) => ({ cardId: `cz:s${i}:0`, isNew: false });

test("shownUnits: sentence, lr options and paradigm members", () => {
  assert.deepEqual([...shownUnits(cz(0), sents[0], content)].sort(), ["a0.base", "b0.base"]);
  const withOpts = shownUnits({ cardId: "lr:s0" }, sents[0], content, [sents[0], sents[1]]);
  assert.deepEqual([...withOpts].sort(), ["a0.base", "a1.base", "b0.base", "b1.base"]);
  const pg = shownUnits({ cardId: "pg:f", members: ["s1", "s2"] }, null, content);
  assert.deepEqual([...pg].sort(), ["a1.base", "a2.base", "b1.base", "b2.base"]);
});

test("isPrimed ignores lr, checks, paradigms and re-queued cards", () => {
  const shown = new Set(["a0.base"]);
  assert.equal(isPrimed(cz(0), shown, content), true);
  assert.equal(isPrimed(cz(1), shown, content), false);
  assert.equal(isPrimed({ cardId: "lr:s0", isNew: true }, shown, content), false);
  assert.equal(isPrimed({ ...cz(0), check: true }, shown, content), false);
  assert.equal(isPrimed({ cardId: "pg:f", members: ["s0"] }, shown, content), false);
  assert.equal(isPrimed({ ...cz(0), requeued: true }, shown, content), false);
});

test("deferPrimed swaps inside the window, defers when none is free, keeps order otherwise", () => {
  const shown = new Set(["a0.base"]);
  const q = [cz(0), cz(1), cz(2)];
  const swapped = deferPrimed(q, 0, shown, content);
  assert.deepEqual(swapped.queue.map((x) => x.cardId), ["cz:s1:0", "cz:s0:0", "cz:s2:0"]);
  assert.deepEqual(swapped.deferred, []);
  assert.equal(q[0].cardId, "cz:s0:0", "input not mutated");

  const all = deferPrimed([cz(0), { cardId: "cz:s0:0" }, cz(1)].slice(0, 2), 0, shown, content);
  assert.deepEqual(all.queue.map((x) => x.cardId), ["cz:s0:0"], "last card left is kept");
  assert.equal(all.deferred.length, 1);

  const none = deferPrimed([cz(1), cz(2)], 0, shown, content);
  assert.deepEqual(none.queue, [cz(1), cz(2)]);
  assert.deepEqual(none.deferred, []);
});

test("a primed success earns partial credit only", () => {
  const prev = { ...newCard(NOW - 10 * DAY_MS), state: 2, due: NOW, lastReview: NOW - 10 * DAY_MS, baseGap: 10 };
  const st = { ...state(), cards: { "cz:s0:0": prev } };
  const units = unitsRequiredForCard("cz:s0:0", content);
  const primed = applyReview(st, "cz:s0:0", 3, units, NOW, content, "cz:s0:0", { primed: true });
  assert.deepEqual(primed.cards["cz:s0:0"], partialCredit(prev, PRIMED_CREDIT, NOW, { multiplier: 1 }));
  assert.equal(primed.cards["cz:s0:0"].baseGap, 10);
  assert.equal(primed.calibration?.log?.length ?? 0, st.calibration?.log?.length ?? 0);
  const full = applyReview(st, "cz:s0:0", 3, units, NOW, content);
  assert.ok(primed.cards["cz:s0:0"].due < full.cards["cz:s0:0"].due);
  const wrong = applyReview(st, "cz:s0:0", 1, units, NOW, content, "cz:s0:0", { primed: true });
  assert.deepEqual(wrong.cards["cz:s0:0"], scheduleCard(prev, 1, NOW));
});
