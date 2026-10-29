import { test } from "node:test";
import assert from "node:assert/strict";
import { readyCount, listRows } from "../app/js/ui/views/lists.js";
import { lexemeModel } from "../app/js/ui/views/lexeme.js";
import { pickNewSentences } from "../app/js/core/select.js";
import { buildSession, focusFirst } from "../app/js/core/session.js";
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
