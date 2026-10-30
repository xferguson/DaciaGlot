import { test } from "node:test";
import assert from "node:assert/strict";
import { readyCount, listRows, progressCounts, parseFocusParam, focusParam, toggleFocus } from "../app/js/ui/views/lists.js";
import { lexemeModel } from "../app/js/ui/views/lexeme.js";
import { pickNewSentences } from "../app/js/core/select.js";
import { buildSession, focusFirst, inFocus } from "../app/js/core/session.js";
import { newCard } from "../app/js/core/fsrs.js";
import { partsFor } from "../app/js/ui/components/feedback.js";
import { makeContent, sentence, state, NOW } from "./helpers/mini-content.mjs";

const pat = (id, requires = []) => ({ id, name: `P ${id}`, stage: 1, level: "A1", requires, minLexemesForProducing: 5, slotLabel: id });
const lex = (id, freq) => ({ id, lemma: id, pos: "verb", gloss: id, freq, forms: { base: id }, keyForms: ["base"] });
const u = (l, pattern) => ({ lex: l, form: "base", ...(pattern ? { pattern } : {}) });
const sent = (id, units, extra) => sentence(id, units.map((_, i) => `w${i}`).join(" "), units, extra);

function fixture() {
  const content = makeContent(
    [
      sent("a1", [u("a", "p1")], { patterns: ["p1"], situations: ["me"] }),
      sent("a2", [u("a", "p1"), u("b")], { patterns: ["p1"], situations: ["me"] }),
      sent("c1", [u("c", "p2")], { patterns: ["p2"], situations: ["table"] }),
    ],
    [lex("a", 1), lex("b", 2), lex("c", 3)],
    [pat("p1"), pat("p2", ["p1"])],
  );
  return content;
}

test("readyCount matches select.js output for a fixture state", () => {
  const content = fixture();
  const st = state();
  const now = NOW;
  for (const focus of [{ type: "pattern", id: "p1" }, { type: "situation", id: "me" }, { type: "situation", id: "table" }]) {
    const pick = pickNewSentences(Infinity, { focus, state: st, content, now, rng: () => 0.5 });
    const expected = pick.blocked ? 0 : pick.sentences.filter((id) => {
      const s = content.sentences.get(id);
      return focus.type === "pattern" ? s.patterns.includes(focus.id) : s.situations.includes(focus.id);
    }).length;
    assert.equal(readyCount(focus, { state: st, content, now }), expected);
  }
  // p2 needs p1 (cold start), so it is blocked.
  assert.equal(readyCount({ type: "pattern", id: "p2" }, { state: st, content, now: NOW }), 0);
});

test("listRows: patterns with unmet prerequisites carry `needs`", () => {
  const rows = listRows("patterns", { state: state(), content: fixture(), now: NOW });
  assert.deepEqual(rows.find((r) => r.id === "p2").needs, ["P p1"]);
  assert.deepEqual(rows.find((r) => r.id === "p1").needs, []);
  assert.deepEqual(listRows("situations", { state: state(), content: fixture(), now: NOW }).map((r) => r.id).sort(), ["me", "table"]);
});

test("focus session: every new sentence carries the pattern; due cards for it come first", () => {
  const content = fixture();
  const st = state();
  const focus = { type: "pattern", id: "p1" };
  const { queue } = buildSession({ mode: "focus", focus, state: st, content, now: NOW, rng: () => 0.5 });
  const fresh = queue.filter((q) => q.isNew && q.cardId.startsWith("lr:")).map((q) => q.cardId.split(":")[1]);
  assert.ok(fresh.length > 0);
  for (const id of fresh) assert.ok(content.sentences.get(id).patterns.includes("p1"));
  assert.deepEqual(focusFirst(["lr:c1", "lr:a1"], { type: "pattern", id: "p1" }, content), ["lr:a1", "lr:c1"]);
});

test("lexemeModel lists key forms with state and seen sentences only", () => {
  const content = fixture();
  const st = state();
  st.seenSentences.a1 = NOW - 1;
  const m = lexemeModel("a", st, content, NOW);
  assert.equal(m.forms[0].state, "seen");
  assert.deepEqual(m.sentences.map((s) => s.id), ["a1"]);
  assert.equal(lexemeModel("zzz", st, content, NOW), null);
});

test("partsFor attaches lexeme ids for tapping", () => {
  const tokens = fixture().sentences.get("a2").tokens;
  const parts = partsFor(tokens, tokens.map((t) => ({ token: t.t, status: "ok" })));
  assert.deepEqual(parts.map((p) => p.lex), ["a", "b"]);
});

test("progressCounts: learned, learning, to learn", () => {
  const st = state();
  st.seenSentences = { a: 1, b: 1 };
  assert.deepEqual(progressCounts(["a", "b", "c", "d"], st, new Set(["a"])), { learned: 1, learning: 1, toLearn: 2, total: 4 });
});

test("listRows: every row carries learned / learning / to learn", () => {
  const st = state();
  st.seenSentences.a1 = NOW - 1;
  const me = listRows("situations", { state: st, content: fixture(), now: NOW }).find((r) => r.id === "me");
  assert.deepEqual([me.learned, me.learning, me.toLearn, me.total], [0, 1, 1, 2]);
  const p1 = listRows("patterns", { state: st, content: fixture(), now: NOW }).find((r) => r.id === "p1");
  assert.equal(p1.learning + p1.toLearn + p1.learned, 2);
});

test("focus filters every mode: only its due cards, only its new sentences, no kf", () => {
  const content = fixture();
  const st = state();
  for (const id of ["lr:a1", "lr:c1", "kf:a:base"]) st.cards[id] = { ...newCard(NOW), due: NOW - 1000 };
  const focus = { type: "situation", id: "me" };
  const review = buildSession({ mode: "review", focus, state: st, content, now: NOW, rng: () => 0.5 });
  assert.deepEqual(review.queue.map((q) => q.cardId), ["lr:a1"]);
  const learn = buildSession({ mode: "learn", focus, state: st, content, now: NOW, rng: () => 0.5 });
  assert.ok(learn.queue.every((q) => q.cardId.startsWith("fm:") || inFocus(q.cardId, focus, content)));
  assert.equal(inFocus("kf:a:base", focus, content), false);
  assert.equal(inFocus("kf:a:base", null, content), true);
  // an fm is in focus when any seen sentence that can carry it is
  const seen = { ...st, seenSentences: { a1: NOW } };
  assert.equal(inFocus("fm:a:base", focus, content, seen), true);
  assert.equal(inFocus("fm:a:base", focus, content, { ...st, seenSentences: {} }), false);
});

test("several focus topics: union of their cards; Mix adds a few overdue cards from outside", () => {
  const content = fixture();
  const st = state();
  for (const id of ["lr:a1", "lr:c1"]) st.cards[id] = { ...newCard(NOW), due: NOW - 1000 };
  const both = [{ type: "situation", id: "me" }, { type: "situation", id: "table" }];
  const review = buildSession({ mode: "review", focus: both, state: st, content, now: NOW, rng: () => 0.5 });
  assert.deepEqual(review.queue.map((q) => q.cardId).sort(), ["lr:a1", "lr:c1"]);
  const me = [{ type: "situation", id: "me" }];
  assert.deepEqual(buildSession({ mode: "review", focus: me, state: st, content, now: NOW, rng: () => 0.5 }).queue.map((q) => q.cardId), ["lr:a1"]);
  const mix = buildSession({ mode: "mix", focus: me, state: st, content, now: NOW, rng: () => 0.5 });
  assert.ok(mix.queue.some((q) => q.cardId === "lr:c1"), "overdue outside-focus card slipped in");
});

test("focus route params round-trip; toggleFocus adds and removes", () => {
  const f = [{ type: "situation", id: "me" }, { type: "pattern", id: "p1" }];
  const q = new URLSearchParams(focusParam(f).slice(1));
  assert.deepEqual(parseFocusParam(Object.fromEntries(q)), f);
  assert.deepEqual(parseFocusParam({ type: "pattern", id: "p1" }), [{ type: "pattern", id: "p1" }]);
  assert.deepEqual(parseFocusParam({}), []);
  assert.deepEqual(toggleFocus([f[0]], f[1]), f);
  assert.deepEqual(toggleFocus(f, f[0]), [f[1]]);
});
