import { test } from "node:test";
import assert from "node:assert/strict";
import { pickNewSentences } from "../app/js/core/select.js";
import { buildSession } from "../app/js/core/session.js";
import { isKnown } from "../app/js/core/units.js";
import { makeContent, sentence, state, NOW } from "./helpers/mini-content.mjs";

const rng = () => 0.5;
const pat = (id, requires = [], stage = 1) => ({ id, name: id, stage, level: "A1", requires, minLexemesForProducing: 5, slotLabel: id });
const lex = (id, freq) => ({ id, lemma: id, pos: "verb", gloss: id, freq });
const unit = (l, form = "base", pattern) => ({ lex: l, form, ...(pattern ? { pattern } : {}) });
const sent = (id, units, extra = {}) => ({
  ...sentence(id, units.map((_, i) => `w${i}`).join(" "), units),
  ...extra,
});
const pick = (n, focus, st, content) => pickNewSentences(n, { focus, state: st, content, now: NOW, rng });

// Introduce a sentence: seen + a correct attempt on each of its lexeme-form units.
function learn(st, content, id) {
  st.seenSentences[id] = NOW - 1000;
  for (const t of content.sentences.get(id).tokens) {
    for (const u of t.units) st.attempts.push({ u: `${u.lex}.${u.form}`, lx: u.lex, c: 1, t: NOW - 1000, card: `cz:${id}:0` });
  }
}

test("cross-prioritization: known a mânca from `table` pulls the perfect-compus sentence first", () => {
  const patterns = [pat("pres"), pat("perfect-compus")];
  const lexemes = [lex("manca", 50), lex("citi", 60), lex("aux", 3)];
  const content = makeContent(
    [
      sent("t1", [unit("manca", "inf", "pres")], { situations: ["table"], patterns: ["pres"] }),
      sent("pc-eat", [unit("aux", "1sg", "perfect-compus"), unit("manca", "inf", "pres")], { patterns: ["perfect-compus", "pres"], situations: ["table"] }),
      sent("pc-read", [unit("aux", "1sg", "perfect-compus"), unit("citi", "inf", "pres")], { patterns: ["perfect-compus", "pres"], situations: ["me"] }),
    ],
    lexemes,
    patterns,
  );
  const st = state();
  learn(st, content, "t1");
  st.attempts.push({ u: "aux.1sg", lx: "aux", c: 1, t: NOW - 500, card: "cz:t1:0" });
  const r = pick(1, { type: "pattern", id: "perfect-compus" }, st, content);
  assert.deepEqual(r.sentences, ["pc-eat"]);
});

test("situation focus prefers a sentence whose only unknown is a word, not a pattern", () => {
  const patterns = [pat("pres"), pat("neg")];
  const content = makeContent(
    [
      sent("base", [unit("a", "base", "pres")], { patterns: ["pres"], situations: ["other"] }),
      sent("new-word", [unit("a", "base", "pres"), unit("b")], { patterns: ["pres"], situations: ["work"] }),
      sent("new-pattern", [unit("a", "base", "neg")], { patterns: ["neg"], situations: ["work"] }),
    ],
    [lex("a", 1), lex("b", 2)],
    patterns,
  );
  const st = state();
  learn(st, content, "base");
  const r = pick(1, { type: "situation", id: "work" }, st, content);
  assert.deepEqual(r.sentences, ["new-word"]);
});

test("invariant: never novelty 0 or > 2, over 200 random states", () => {
  const patterns = [pat("p1"), pat("p2", ["p1"], 2)];
  const lexemes = Array.from({ length: 12 }, (_, i) => lex(`l${i}`, i + 1));
  let seed = 7;
  const r = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  const sents = Array.from({ length: 40 }, (_, i) => {
    const n = 1 + Math.floor(r() * 4);
    const us = Array.from({ length: n }, () => unit(`l${Math.floor(r() * 12)}`));
    const p = r() < 0.5 ? "p1" : "p2";
    return sent(`s${i}`, us, { patterns: [p], stage: p === "p1" ? 1 : 2, situations: [r() < 0.5 ? "a" : "b"] });
  });
  const content = makeContent(sents, lexemes, patterns);
  for (let i = 0; i < 200; i++) {
    const st = state();
    for (const s of sents) if (r() < 0.3) learn(st, content, s.id);
    const focus = [null, { type: "pattern", id: "p1" }, { type: "situation", id: "a" }][i % 3];
    const res = pickNewSentences(5, { focus, state: st, content, now: NOW, rng: r });
    for (const id of res.sentences ?? []) {
      const s = content.sentences.get(id);
      assert.ok(!(id in st.seenSentences));
      const units = new Set([...s.tokens.flatMap((t) => t.units.map((u) => `${u.lex}.${u.form}`)), ...s.patterns.map((p) => `pat:${p}`)]);
      const novelty = [...units].filter((u) => !isKnown(u, st, content)).length;
      assert.ok(novelty >= 1 && novelty <= 2, `${id} novelty ${novelty}`);
    }
  }
});

test("blocked: suggests the unmet prerequisite with the most focus sentences behind it", () => {
  const patterns = [pat("have"), pat("perfect", ["have"]), pat("other")];
  const content = makeContent(
    [
      sent("pc1", [unit("x")], { patterns: ["perfect"] }),
      sent("pc2", [unit("y")], { patterns: ["perfect"] }),
      sent("h1", [unit("z")], { patterns: ["have"], situations: ["q"] }),
    ],
    [lex("x", 1), lex("y", 2), lex("z", 3)],
    patterns,
  );
  const r = pick(3, { type: "pattern", id: "perfect" }, state(), content);
  assert.deepEqual(r, { blocked: true, suggest: { type: "pattern", id: "have" } });
});

test("buildSession returns blocked + suggest; cold start without focus falls back to the interim order", () => {
  const patterns = [pat("have"), pat("perfect", ["have"])];
  const content = makeContent(
    [sent("pc1", [unit("x")], { patterns: ["perfect"] }), sent("h1", [unit("z"), unit("w"), unit("v")], { patterns: ["have"] })],
    [lex("x", 1), lex("z", 2), lex("w", 3), lex("v", 4)],
    patterns,
  );
  const b = buildSession({ mode: "focus", focus: { type: "pattern", id: "perfect" }, state: state(), content, now: NOW, rng });
  assert.equal(b.blocked, true);
  assert.deepEqual(b.suggest, { type: "pattern", id: "have" });
  // h1 has novelty 4 (3 words + pattern); select yields nothing, interim fills in.
  const c = buildSession({ mode: "session", state: state(), content, now: NOW, rng });
  assert.ok(c.queue.some((q) => q.cardId === "lr:h1" || q.cardId === "lr:pc1"));
});

test("no two picks in one call share an unknown unit", () => {
  const content = makeContent(
    [sent("a", [unit("k"), unit("n")]), sent("b", [unit("k"), unit("m")]), sent("c", [unit("q"), unit("r")])],
    [lex("k", 1), lex("n", 2), lex("m", 3), lex("q", 4), lex("r", 5)],
    [],
  );
  const st = state();
  for (const l of ["n", "m", "r"]) st.attempts.push({ u: `${l}.base`, lx: l, c: 1, t: NOW - 1, card: "cz:x:0" });
  const r = pick(3, null, st, content);
  assert.equal(r.sentences.length, 2);
  assert.ok(r.sentences.includes("c"));
});
