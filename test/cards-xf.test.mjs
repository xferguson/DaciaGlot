import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FORM_LABELS, LEIPZIG, leipzigFor, opInstruction, opPatterns, isUnlocked, slotsFor, transformUnits, pickPerSentence, newTransformCards,
} from "../app/js/core/cards.js";
import { unitsRequiredForCard } from "../app/js/core/units.js";
import { buildSession } from "../app/js/core/session.js";
import { checkAnswer } from "../app/js/core/check.js";
import { newCard } from "../app/js/core/fsrs.js";
import { makeContent, state, NOW } from "./helpers/mini-content.mjs";

const lex = (id, lemma, forms, extra = {}) => ({ id, lemma, pos: "verb", gloss: id, forms, ...extra });
const lexemes = [
  lex("ieri", "ieri", { base: "ieri" }, { pos: "adv" }),
  lex("aux-perf", "a avea", { "1sg": "am", "1pl": "am", "3sg": "a" }, { pos: "aux" }),
  lex("nu", "nu", { base: "nu", short: "n" }, { pos: "adv" }),
  lex("termina", "a termina", { ppl: "terminat" }),
  lex("sprint", "sprint", { sgDef: "sprintul" }, { pos: "noun" }),
  lex("avea", "a avea", { pres1sg: "am", pres3sg: "are" }),
  lex("problema", "problemă", { sg: "problemă" }, { pos: "noun" }),
  lex("un", "un", { f: "o" }, { pos: "det" }),
];
const patterns = [
  { id: "perfect-compus", slotLabel: "past" },
  { id: "neg-nu", slotLabel: "not" },
  { id: "have-pres", slotLabel: "have" },
  { id: "clitic-acc", slotLabel: "them" },
  { id: "def-sg", slotLabel: "the" },
];
const tok = (t, units, extra = {}) => ({ t, units, ...extra });
const s1 = {
  id: "s1", ro: "Ieri am terminat sprintul.", en: "We finished the sprint yesterday.", level: "A1", stage: 1,
  situations: ["x"], register: "neutral", patterns: ["perfect-compus", "def-sg"],
  tokens: [
    tok("Ieri", [{ lex: "ieri", form: "base" }]),
    tok("am", [{ lex: "aux-perf", form: "1pl", pattern: "perfect-compus" }], { glue: "aux" }),
    tok("terminat", [{ lex: "termina", form: "ppl", pattern: "perfect-compus", head: true }], { cloze: true }),
    tok("sprintul.", [{ lex: "sprint", form: "sgDef", pattern: "def-sg", head: true }], { cloze: true }),
  ],
  transforms: [
    { op: "negate", ro: "Ieri n-am terminat sprintul.", accept: ["Ieri nu am terminat sprintul."], targetTokens: [1] },
    { op: "person:1pl>3sg", ro: "Ieri a terminat sprintul.", en: "He/She finished the sprint yesterday.", targetTokens: [1] },
  ],
};
const s2 = {
  id: "s2", ro: "Am o problemă.", en: "I have a problem.", level: "A1", stage: 1, situations: ["x"],
  register: "neutral", patterns: ["have-pres"],
  tokens: [
    tok("Am", [{ lex: "avea", form: "pres1sg", pattern: "have-pres", head: true }]),
    tok("o", [{ lex: "un", form: "f" }]),
    tok("problemă.", [{ lex: "problema", form: "sg" }]),
  ],
  transforms: [{ op: "negate", ro: "N-am o problemă.", accept: ["Nu am o problemă."], targetTokens: [0] }],
};
// Carries `neg-nu`, so negate transforms can unlock once it has been seen.
const sNeg = {
  id: "sneg", ro: "Nu sunt", en: "I am not", level: "A1", stage: 1, situations: ["x"], register: "neutral",
  patterns: ["neg-nu"], tokens: [tok("Nu", [{ lex: "nu", form: "base", pattern: "neg-nu", head: true }]), tok("sunt", [{ lex: "nu", form: "base" }])],
};
const content = makeContent([s1, s2, sNeg], lexemes, patterns);

const seen = (...ids) => {
  const st = state();
  for (const id of ["sneg", ...ids]) st.seenSentences[id] = NOW;
  return st;
};

test("opInstruction covers every op in the vocabulary", () => {
  const cases = {
    negate: "Make it negative",
    affirm: "Make it positive",
    "person:1sg>3sg": "→ he/she",
    "person:3sg>1pl": "→ we",
    "tense:pres>perf": "→ past",
    "tense:perf>fut": "→ future",
    "tense:fut>pres": "→ present",
    "tense:pres>cond": "→ would",
    "add-obj:acc-3pl-m": "Replace the object with 'them'",
    "add-obj:acc-3sg-f": "Replace the object with 'her/it'",
    "add-dat:dat-1sg": "Add 'to me'",
    "modal:vrea": "Start with 'I want'",
    "modal:putea": "Start with 'I can'",
    "modal:trebui": "Start with 'I must'",
    question: "Make it a question",
    plural: "→ plural",
    singular: "→ singular",
    definite: "→ the X",
    indefinite: "→ a X",
    formal: "→ dumneavoastră",
  };
  for (const [op, text] of Object.entries(cases)) assert.equal(opInstruction(op), text, op);
});

test("opPatterns maps ops to their own patterns", () => {
  assert.deepEqual(opPatterns("negate"), ["neg-nu"]);
  assert.deepEqual(opPatterns("tense:pres>perf"), ["perfect-compus"]);
  assert.deepEqual(opPatterns("person:1sg>3sg"), []);
});

test("sb unlocks once the sentence and op patterns are seen", () => {
  assert.equal(isUnlocked("sb:s1:0", state(), content), false, "sentence not seen");
  const noNeg = state();
  noNeg.seenSentences.s1 = NOW;
  assert.equal(isUnlocked("sb:s1:0", noNeg, content), false, "neg-nu not seen yet");
  assert.equal(isUnlocked("sb:s1:0", seen("s1"), content), true);
  assert.equal(isUnlocked("sb:s1:9", seen("s1"), content), false, "no such transform");
});

test("sb waits for a pattern that is not yet seen", () => {
  assert.equal(isUnlocked("sb:s1:1", seen("s1"), content), true, "person change needs only perfect-compus");
  const bare = makeContent([s1], lexemes, [{ id: "perfect-compus", slotLabel: "past" }, { id: "def-sg", slotLabel: "the" }]);
  assert.equal(isUnlocked("sb:s1:1", { ...state(), seenSentences: {} }, bare), false);
});

test("xf additionally needs every lexeme's key-forms cards introduced", () => {
  const kfLexemes = lexemes.map((l) => (l.id === "termina" ? { ...l, forms: { ...l.forms, pres1sg: "termin" }, keyForms: ["ppl", "pres1sg"] } : l));
  const c = makeContent([s1, sNeg], kfLexemes, patterns);
  const st = seen("s1");
  assert.equal(isUnlocked("sb:s1:0", st, c), true);
  assert.equal(isUnlocked("xf:s1:0", st, c), false);
  st.cards["fm:termina:ppl"] = newCard(NOW);
  assert.equal(isUnlocked("xf:s1:0", st, c), false);
  st.cards["fm:termina:pres1sg"] = newCard(NOW);
  assert.equal(isUnlocked("xf:s1:0", st, c), true);
  assert.equal(isUnlocked("xf:s1:0", state(), c), false, "sentence not seen");
});

test("slotsFor: negate with a clitic cluster", () => {
  const slots = slotsFor(s1, s1.transforms[0], content);
  assert.deepEqual(slots, [
    { type: "word", text: "ieri" },
    { type: "slot", labels: ["not", "past"], gloss: ["nu", "aux-perf.1PL"], patterns: ["neg-nu", "perfect-compus"].filter((p) => content.patterns.has(p)) },
    { type: "word", text: "termina" },
    { type: "word", text: "sprint" },
  ]);
});

test("slotsFor: person change shows only the changed token's pattern", () => {
  const slots = slotsFor(s1, s1.transforms[1], content);
  assert.deepEqual(slots.map((s) => (s.type === "word" ? s.text : s.labels.join("+"))), ["ieri", "past", "termina", "sprint"]);
});

test("slotsFor: negate on a have-sentence", () => {
  const slots = slotsFor(s2, s2.transforms[0], content);
  assert.deepEqual(slots.map((s) => (s.type === "word" ? s.text : s.labels.join("+"))), ["not+have", "un", "problemă"]);
});

test("xf accepts both n-am and nu am", () => {
  const t = s1.transforms[0];
  assert.notEqual(checkAnswer("Ieri n-am terminat sprintul.", t.ro, t.accept).result, "wrong");
  assert.notEqual(checkAnswer("Ieri nu am terminat sprintul.", t.ro, t.accept).result, "wrong");
  assert.equal(checkAnswer("Ieri am terminat sprintul.", t.ro, t.accept).result, "wrong");
});

test("transformUnits: clitic cluster resolves to its parts plus pattern units", () => {
  const u = transformUnits(s1, s1.transforms[0], content);
  const ids = u.map((x) => x.u).sort();
  assert.deepEqual(ids, ["aux-perf.1pl", "nu.short", "pat:neg-nu", "pat:perfect-compus"]);
  assert.equal(u.find((x) => x.u === "pat:perfect-compus").lx, "termina", "pattern attempts use the head lexeme");
  assert.deepEqual(unitsRequiredForCard("xf:s1:0", content), u);
  assert.deepEqual(unitsRequiredForCard("sb:s1:0", content), u);
});

test("transformUnits: an ambiguous form records only pattern units", () => {
  // "am" is avea.pres1sg and aux-perf.1sg/1pl; the source's target token (a noun) gives no hint to choose.
  const t = { op: "person:3sg>1sg", ro: "Am o problemă.", targetTokens: [2] };
  const u = transformUnits(s2, t, content);
  assert.deepEqual(u.map((x) => x.u), []);
});

test("pickPerSentence applies xf > cz > sb per sentence, only when xf/sb are present", () => {
  assert.deepEqual(pickPerSentence(["cz:s1:2", "sb:s1:0", "xf:s1:0"]), ["xf:s1:0"]);
  assert.deepEqual(pickPerSentence(["sb:s1:0", "cz:s1:2", "cz:s2:0"]), ["cz:s1:2", "cz:s2:0"]);
  assert.deepEqual(pickPerSentence(["cz:s1:2", "cz:s1:3", "lr:s1"]), ["cz:s1:2", "cz:s1:3", "lr:s1"]);
  assert.deepEqual(pickPerSentence(["xf:s1:0", "xf:s1:1", "kf:avea:pres1sg"]), ["xf:s1:0", "kf:avea:pres1sg"]);
});

test("newTransformCards introduces one card per seen sentence, xf before sb", () => {
  const st = seen("s1", "s2");
  assert.deepEqual(newTransformCards(st, content), ["xf:s1:0", "xf:s2:0"]);
  st.cards["xf:s1:0"] = newCard(NOW);
  st.cards["xf:s2:0"] = newCard(NOW);
  assert.deepEqual(newTransformCards(st, content), ["xf:s1:1", "sb:s2:0"]);
  assert.deepEqual(newTransformCards(st, content, { cap: 1 }), ["xf:s1:1"]);
  assert.deepEqual(newTransformCards(st, content, { skip: new Set(["s1"]) }), ["sb:s2:0"]);
});

test("session mode appends new xf/sb cards; quick mode does not", () => {
  const st = seen("s1");
  const full = buildSession({ mode: "session", state: st, content, now: NOW, rng: Math.random, newSentenceIds: [] });
  assert.deepEqual(full.queue.map((q) => q.cardId), ["xf:s1:0"]);
  const quick = buildSession({ mode: "quick", state: st, content, now: NOW, rng: Math.random });
  assert.deepEqual(quick.queue, []);
});

test("a due xf suppresses a due cz and any new card for the same sentence", () => {
  const st = seen("s1");
  const old = { ...newCard(NOW - 10 * 86400000), due: NOW - 1000 };
  st.cards["lr:s1"] = old;
  st.cards["cz:s1:2"] = old;
  st.cards["xf:s1:0"] = old;
  const ids = buildSession({ mode: "session", state: st, content, now: NOW, rng: Math.random, newSentenceIds: [] })
    .queue.map((q) => q.cardId);
  assert.ok(ids.includes("xf:s1:0") && ids.includes("lr:s1"));
  assert.ok(!ids.includes("cz:s1:2"));
  assert.equal(ids.filter((id) => id.endsWith(":s1:1") || id.startsWith("sb:s1")).length, 0);
});

test("LEIPZIG covers every FORM_LABELS key", () => {
  for (const k of Object.keys(FORM_LABELS)) assert.ok(k in LEIPZIG, k);
  assert.equal(LEIPZIG.sgGenDat, "SG.DEF.GEN-DAT");
  assert.equal(LEIPZIG.accShort, "ACC.CL");
});

test("leipzigFor: lemma gloss, lemmaGloss override, pronoun person first, small-caps used as is", () => {
  assert.equal(leipzigFor({ id: "fi", pos: "verb", gloss: "to be" }, "pres2sg"), "be.PRS.2SG");
  assert.equal(leipzigFor({ id: "locui", pos: "verb", gloss: "to live (somewhere)" }, "pres1sg"), "live.PRS.1SG");
  assert.equal(leipzigFor({ id: "putea", pos: "verb", gloss: "to be able, can", lemmaGloss: "can" }, "inf"), "can.INF");
  assert.equal(leipzigFor({ id: "nu", pos: "particle", gloss: "not", lemmaGloss: "NEG" }, "base"), "NEG");
  assert.equal(leipzigFor({ id: "x", pos: "particle", gloss: "NEG" }, "short"), "NEG");
  assert.equal(leipzigFor({ id: "pron-2sg", pos: "pron", gloss: "you" }, "accShort"), "2SG.ACC.CL");
  assert.equal(leipzigFor({ id: "pron-3pl-f", pos: "pron", gloss: "them (f)" }, "datShort"), "3PL.F.DAT.CL");
});

test("slotsFor: a person change is glossed with the wanted form", () => {
  const lx = [...lexemes, lex("fi", "a fi", { pres1sg: "sunt", pres2sg: "ești" }, { gloss: "to be" }), lex("cluj", "Cluj", { base: "Cluj" }, { pos: "noun" })];
  const sent = {
    id: "s3", ro: "Sunt din Cluj.", en: "I am from Cluj.", level: "A1", stage: 1, situations: ["x"], register: "neutral", patterns: [],
    tokens: [tok("Sunt", [{ lex: "fi", form: "pres1sg" }]), tok("din", []), tok("Cluj.", [{ lex: "cluj", form: "base" }])],
    transforms: [{ op: "person:1sg>2sg", ro: "Ești din Cluj.", targetTokens: [0] }],
  };
  const slots = slotsFor(sent, sent.transforms[0], makeContent([sent], lx, patterns));
  assert.deepEqual(slots[0].gloss, ["be.PRS.2SG"]);
});

test("slotsFor: an unresolvable slot keeps the pattern label as the fallback", () => {
  const sent = {
    id: "s4", ro: "Am o problemă.", en: "I have a problem.", level: "A1", stage: 1, situations: ["x"], register: "neutral", patterns: ["have-pres"],
    tokens: [tok("Am", [{ lex: "avea", form: "pres1sg", pattern: "have-pres", head: true }]), tok("o", [{ lex: "un", form: "f" }]), tok("problemă.", [{ lex: "problema", form: "sg" }])],
    transforms: [{ op: "negate", ro: "Zzz o problemă.", targetTokens: [0] }],
  };
  const slots = slotsFor(sent, sent.transforms[0], makeContent([sent], lexemes, patterns));
  assert.deepEqual(slots[0].gloss, []);
  assert.deepEqual(slots[0].labels, ["not", "have"]);
});
