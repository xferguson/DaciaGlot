import { test } from "node:test";
import assert from "node:assert/strict";
import { claimCheckDue, CLAIM_CHECK_DAYS } from "../app/js/core/cards.js";
import { dueCards } from "../app/js/core/due.js";
import { buildSession } from "../app/js/core/session.js";
import { dropClaimDuplicates } from "../app/js/core/queue.js";
import { applyErReview } from "../app/js/core/session.js";
import { unitsRequiredForCard } from "../app/js/core/units.js";
import { newCard } from "../app/js/core/fsrs.js";
import { makeContent, state, NOW } from "./helpers/mini-content.mjs";

const DAY = 86400000;
const tok = (t, units, extra = {}) => ({ t, units, ...extra });
const s1 = {
  id: "s1", ro: "Am o problemă.", en: "I have a problem.", level: "A1", stage: 1, situations: ["x"],
  register: "neutral", patterns: ["have-pres"],
  tokens: [
    tok("Am", [{ lex: "avea", form: "pres1sg", pattern: "have-pres", head: true }], { cloze: true }),
    tok("o", [{ lex: "un", form: "f" }]),
    tok("problemă.", [{ lex: "problema", form: "sg" }], { cloze: true }),
  ],
};
const lexemes = [
  { id: "avea", lemma: "a avea", pos: "verb", gloss: "have", forms: { pres1sg: "am" } },
  { id: "un", lemma: "un", pos: "det", gloss: "a", forms: { f: "o" } },
  { id: "problema", lemma: "problemă", pos: "noun", gloss: "problem", forms: { sg: "problemă" } },
];
const content = makeContent([s1], lexemes, [{ id: "have-pres", slotLabel: "have" }]);
const U1 = "avea.pres1sg", U2 = "problema.sg";

/** Both forms easy (gap ≥ 4 d); `er:s1` last reviewed `erAgo` days ago and due now. */
function base(erAgo, claimed) {
  const st = state();
  st.seenSentences.s1 = NOW - 90 * DAY;
  for (const id of ["fm:avea:pres1sg", "fm:problema:sg"]) st.cards[id] = { ...newCard(NOW), lastReview: NOW - 30 * DAY, due: NOW - DAY, lastGrade: 4 };
  st.cards["er:s1"] = { ...newCard(NOW), lastReview: NOW - erAgo * DAY, due: NOW - DAY };
  st.claimed = Object.fromEntries(claimed.map((u) => [u, NOW - 80 * DAY]));
  return st;
}

test("claimCheckDue: never reviewed, or 60 days since last review", () => {
  assert.equal(CLAIM_CHECK_DAYS, 60);
  assert.equal(claimCheckDue("s1", state(), NOW), true);
  assert.equal(claimCheckDue("s1", base(59, [U1, U2]), NOW), false);
  assert.equal(claimCheckDue("s1", base(60, [U1, U2]), NOW), true);
});

test("all-claimed er is hidden until 60 d after its last review, then due", () => {
  assert.ok(!dueCards(base(30, [U1, U2]), content, NOW).includes("er:s1"));
  assert.ok(dueCards(base(61, [U1, U2]), content, NOW).includes("er:s1"));
  assert.ok(dueCards(base(30, [U1]), content, NOW).includes("er:s1"), "not all claimed: normal");
});

test("a wrong claim check drops the claims", () => {
  const st = base(61, [U1, U2]);
  const misses = { missed: [U1], ok: [U2], missedTokens: [0] };
  const next = applyErReview(st, "er:s1", 1, unitsRequiredForCard("er:s1", content), misses, NOW, content);
  assert.ok(!(U1 in next.claimed));
});

test("all but one claimed: er stays, the last word's fm is dropped", () => {
  const st = base(10, [U1]);
  const q = [{ cardId: "er:s1" }, { cardId: "fm:problema:sg" }, { cardId: "fm:avea:pres1sg" }];
  assert.deepEqual(dropClaimDuplicates(q, { state: st, content }).map((x) => x.cardId), ["er:s1", "fm:avea:pres1sg"]);
});

test("when er isn't queued, the fm stays; with two unclaimed units nothing is dropped", () => {
  const q = [{ cardId: "fm:problema:sg" }];
  assert.equal(dropClaimDuplicates(q, { state: base(10, [U1]), content }).length, 1);
  const q2 = [{ cardId: "er:s1" }, { cardId: "fm:problema:sg" }];
  assert.equal(dropClaimDuplicates(q2, { state: base(10, []), content }).length, 2);
});

test("buildSession queues one card, not two, for all-but-one claimed", () => {
  const st = base(10, [U1]);
  st.cards["fm:problema:sg"].lastGrade = 3;
  st.cards["fm:problema:sg"].due = NOW - DAY;
  const ids = buildSession({ mode: "review", state: st, content, now: NOW, rng: () => 0.5 }).queue.map((x) => x.cardId);
  assert.ok(ids.includes("er:s1") || ids.some((i) => i.startsWith("fm:")));
  assert.ok(!(ids.includes("er:s1") && ids.includes("fm:problema:sg")));
});
