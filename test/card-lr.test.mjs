import { test } from "node:test";
import assert from "node:assert/strict";
import { pickDistractors } from "../app/js/ui/views/card-lr.js";
import { insertAt } from "../app/js/ui/components/diacritic-bar.js";
import { partsFor } from "../app/js/ui/components/feedback.js";
import { hintFor, tokenIndexOf } from "../app/js/ui/views/card-cloze.js";

const mk = (id, ro, lex, patterns = [], situations = ["x"]) => ({
  id, ro, patterns, situations,
  tokens: [{ t: ro, units: lex.map((l) => ({ lex: l, form: "base" })) }],
});

function content(list) {
  const sentences = new Map(list.map((s) => [s.id, s]));
  const idx = (key) => {
    const m = new Map();
    for (const s of list) {
      const keys = key === "lex" ? s.tokens.flatMap((t) => t.units.map((u) => u.lex))
        : key === "pat" ? s.patterns : s.situations;
      for (const k of keys) m.set(k, [...(m.get(k) ?? []), s.id]);
    }
    return m;
  };
  return { sentences, sentencesByLexeme: idx("lex"), sentencesByPattern: idx("pat"), sentencesBySituation: idx("sit") };
}

const rng = () => 0.3;

test("prefers sentences sharing a lexeme", () => {
  const a = mk("a", "A", ["l1"]);
  const list = [a, mk("b", "B", ["l1"]), mk("c", "C", ["l1"]), mk("d", "D", ["l1"]), mk("e", "E", ["zz"], ["p"])];
  const ids = pickDistractors(a, content(list), rng).map((s) => s.id).sort();
  assert.deepEqual(ids, ["b", "c", "d"]);
});

test("falls back to pattern, situation, then anything", () => {
  const a = mk("a", "A", ["l1"], ["p"], ["sit"]);
  const list = [a, mk("b", "B", ["l2"], ["p"]), mk("c", "C", ["l3"], [], ["sit"]), mk("d", "D", ["l4"], [], ["other"]), mk("e", "E", ["l5"], [], ["other"])];
  const out = pickDistractors(a, content(list), rng).map((s) => s.id);
  assert.equal(out[0], "b");
  assert.equal(out[1], "c");
  assert.equal(out.length, 3);
});

test("never includes the answer or duplicate text", () => {
  const a = mk("a", "Same", ["l1"]);
  const list = [a, mk("b", "Same", ["l1"]), mk("c", "C", ["l1"]), mk("d", "C", ["l1"]), mk("e", "E", ["l1"])];
  const out = pickDistractors(a, content(list), rng);
  assert.ok(!out.some((s) => s.id === "a" || s.ro === "Same"));
  assert.equal(new Set(out.map((s) => s.ro)).size, out.length);
  assert.equal(out.length, 2);
});

test("insertAt replaces the selection and moves the caret", () => {
  assert.deepEqual(insertAt("casa", 3, 3, "ă"), { value: "casăa", caret: 4 });
  assert.deepEqual(insertAt("abcd", 1, 3, "ț"), { value: "ațd", caret: 2 });
});

test("partsFor substitutes the diff at the cloze token", () => {
  const tokens = [{ t: "Azi" }, { t: "lucrez" }, { t: "bine." }];
  const parts = partsFor(tokens, [{ token: "lucrez", status: "wrong" }], 1);
  assert.deepEqual(parts.map((p) => p.status), ["ok", "wrong", "ok"]);
});

test("hint reveals first letter of wrong tokens only", () => {
  assert.equal(hintFor("", "terminat"), "t…");
  assert.equal(hintFor("terminat", "terminat"), "");
});

test("tokenIndexOf parses the card id", () => {
  assert.equal(tokenIndexOf("cz:s-a1-standup-0001:2"), 2);
  assert.equal(tokenIndexOf({ id: "cz:s:0" }), 0);
});
