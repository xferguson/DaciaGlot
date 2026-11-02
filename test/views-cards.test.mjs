// Q02: characterization tests for the card views. They pin what each card passes to `onResult` today,
// so later refactors (Q05, Q08, Q13, Q14) can rewrite the views safely. Nothing here asserts new behavior.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./helpers/fake-dom.mjs";
import { makeContent } from "./helpers/mini-content.mjs";

installFakeDom();
const { renderCard: renderLr } = await import("../app/js/ui/views/card-lr.js");
const { renderCard: renderCz } = await import("../app/js/ui/views/card-cloze.js");
const { renderCard: renderKf } = await import("../app/js/ui/views/card-keyform.js");
const { renderCard: renderXf } = await import("../app/js/ui/views/card-transform.js");
const { renderCard: renderSb } = await import("../app/js/ui/views/card-slot.js");
const { renderCard: renderEr } = await import("../app/js/ui/views/card-enro.js");
const { renderCard: renderPg } = await import("../app/js/ui/views/card-paradigm.js");

// ---------- content ----------

const tok = (t, units, extra = {}) => ({ t, units, ...extra });
const u = (lex, form, extra = {}) => ({ lex, form, ...extra });
const sent = (id, ro, en, tokens, extra = {}) => ({
  id, ro, en, level: "A1", stage: 1, situations: ["x"], register: "neutral", patterns: [], tokens, ...extra,
});

// "Am o problemă." — a cloze, key-form and en→ro sentence.
const sHave = sent("s1", "Am o problemă.", "I have a problem.", [
  tok("Am", [u("avea", "pres1sg", { pattern: "have-pres", head: true })], { cloze: true }),
  tok("o", [u("un", "f")]),
  tok("problemă.", [u("problema", "sg")], { cloze: true }),
], { patterns: ["have-pres"] });
// "Ieri am terminat sprintul." — transforms for xf/sb.
const sSprint = sent("s2", "Ieri am terminat sprintul.", "We finished the sprint yesterday.", [
  tok("Ieri", [u("ieri", "base")]),
  tok("am", [u("aux-perf", "1pl", { pattern: "perfect-compus" })], { glue: "aux" }),
  tok("terminat", [u("termina", "ppl", { pattern: "perfect-compus", head: true })], { cloze: true }),
  tok("sprintul.", [u("sprint", "sgDef", { pattern: "def-sg", head: true })], { cloze: true }),
], {
  patterns: ["perfect-compus", "def-sg"],
  transforms: [
    { op: "negate", ro: "Ieri n-am terminat sprintul.", accept: ["Ieri nu am terminat sprintul."], targetTokens: [1] },
    { op: "person:1pl>3sg", ro: "Ieri a terminat sprintul.", en: "He/She finished the sprint yesterday.", targetTokens: [1] },
  ],
});
// Distractors for lr.
const sOther = [
  sent("s3", "Am o idee.", "I have an idea.", [tok("Am", [u("avea", "pres1sg")]), tok("o", [u("un", "f")]), tok("idee.", [u("ideea", "sg")])]),
  sent("s4", "Are o problemă.", "He has a problem.", [tok("Are", [u("avea", "pres3sg")]), tok("o", [u("un", "f")]), tok("problemă.", [u("problema", "sg")])]),
  sent("s5", "Am un sprint.", "I have a sprint.", [tok("Am", [u("avea", "pres1sg")]), tok("un", [u("un", "m")]), tok("sprint.", [u("sprint", "sg")])]),
];
// A paradigm family.
const IN = tok("în", [u("in", "base")]);
const CLUJ = tok("Cluj.", [u("cluj", "base")]);
const fam = [
  sent("p1", "El locuiește în Cluj.", "He lives in Cluj.", [tok("El", [u("el", "base")]), tok("locuiește", [u("locui", "pres3sg")], { cloze: true }), IN, CLUJ]),
  sent("p2", "Locuiești în Cluj.", "You live in Cluj.", [tok("Locuiești", [u("locui", "pres2sg")], { cloze: true }), IN, CLUJ]),
  sent("p3", "Locuiesc în Cluj.", "I live in Cluj.", [tok("Locuiesc", [u("locui", "pres1sg")], { cloze: true }), IN, CLUJ]),
];
const lex = (id, lemma, forms, extra = {}) => ({ id, lemma, pos: "verb", gloss: id, forms, ...extra });
const lexemes = [
  lex("avea", "a avea", { pres1sg: "am", pres3sg: "are" }, { gloss: "have" }),
  lex("un", "un", { f: "o", m: "un" }, { pos: "det" }),
  lex("problema", "problemă", { sg: "problemă", pl: "probleme" }, { pos: "noun" }),
  lex("ideea", "idee", { sg: "idee." }, { pos: "noun" }),
  lex("ieri", "ieri", { base: "ieri" }, { pos: "adv" }),
  lex("aux-perf", "a avea", { "1sg": "am", "1pl": "am", "3sg": "a" }, { pos: "aux" }),
  lex("termina", "a termina", { ppl: "terminat" }),
  lex("sprint", "sprint", { sg: "sprint", sgDef: "sprintul" }, { pos: "noun" }),
  lex("el", "el", { base: "el" }, { pos: "pron" }),
  lex("locui", "a locui", { pres3sg: "locuiește", pres2sg: "locuiești", pres1sg: "locuiesc" }, { keyForms: [] }),
  lex("in", "în", { base: "în" }, { pos: "prep" }),
  lex("cluj", "Cluj", { base: "Cluj" }, { pos: "noun" }),
];
const patterns = [
  { id: "have-pres", slotLabel: "have" },
  { id: "perfect-compus", slotLabel: "past" },
  { id: "def-sg", slotLabel: "the" },
];
const content = makeContent([sHave, sSprint, ...sOther, ...fam], lexemes, patterns);
const seq = (...v) => { let i = 0; return () => v[i++ % v.length]; };

// ---------- driving a card ----------

function mount(render, opts) {
  const root = document.createElement("div");
  document.body.append(root);
  const results = [];
  const spoken = [];
  const settingsPatches = [];
  const cleanup = render(root, {
    content,
    tts: { speak: (text, o) => { spoken.push(text); return Promise.resolve(); } },
    settings: {},
    onResult: (r) => results.push(r),
    onSetting: (p) => settingsPatches.push(p),
    rng: seq(0.2, 0.7, 0.4),
    ...opts,
  });
  const buttons = () => root.querySelectorAll("button");
  const btn = (label) => {
    const b = buttons().find((x) => x.textContent === label);
    assert.ok(b, `no "${label}" button; have: ${buttons().map((x) => x.textContent).join(" | ")}`);
    return b;
  };
  const labels = () => buttons().map((b) => b.textContent);
  const inputs = () => root.querySelectorAll("input");
  const type = (text, input = inputs()[0]) => { input.value = text; };
  const enter = (input = inputs()[0]) => input.dispatch("keydown", { key: "Enter" });
  const tap = (label) => btn(label).click();
  return { root, results, spoken, settingsPatches, cleanup, buttons, btn, labels, inputs, type, enter, tap };
}

/** The buttons that end a card: Hard · Medium · Easy when it can be rated, else Continue. */
const RATE = ["Hard", "Medium", "Easy"];
const hasRating = (c) => RATE.every((r) => c.labels().includes(r)) && !c.labels().includes("Continue");
const hasContinueOnly = (c) => c.labels().includes("Continue") && !RATE.some((r) => c.labels().includes(r));

/** Nothing reaches onResult until the learner taps; then exactly one result. */
function finishWith(c, label) {
  assert.deepEqual(c.results, [], "nothing advances without a tap");
  c.tap(label);
  assert.equal(c.results.length, 1);
  c.tap(label); // a double tap fires once
  assert.equal(c.results.length, 1);
  return c.results[0];
}

// ---------- lr ----------

test("lr: the right option, then Continue → correct, attempt 1, no rating", () => {
  const c = mount(renderLr, { card: "lr:s1", sentence: sHave });
  const options = c.root.querySelectorAll(".option");
  assert.equal(options.length, 4);
  assert.deepEqual(c.spoken, ["Am o problemă."], "autoplays the sentence");
  options.find((b) => b.dataset.id === "s1").click();
  assert.ok(hasContinueOnly(c), "never rated");
  assert.ok(options.every((b) => b.disabled));
  assert.deepEqual(finishWith(c, "Continue"), { result: "correct", usedHint: false, attemptNo: 1, rating: null });
});

test("lr: a wrong option marks it and the answer → wrong, attempt 1", () => {
  const c = mount(renderLr, { card: "lr:s1", sentence: sHave, settings: { autoplay: false } });
  assert.deepEqual(c.spoken, [], "no autoplay when off");
  const options = c.root.querySelectorAll(".option");
  const wrong = options.find((b) => b.dataset.id !== "s1");
  wrong.click();
  assert.ok(wrong.classList.contains("wrong"));
  assert.ok(options.find((b) => b.dataset.id === "s1").classList.contains("correct"));
  options.find((b) => b.dataset.id === "s1").click(); // disabled: ignored
  assert.deepEqual(c.spoken, ["Am o problemă."], "plays after answering");
  assert.deepEqual(finishWith(c, "Continue"), { result: "wrong", usedHint: false, attemptNo: 1, rating: null });
});

// ---------- cz ----------

// TODAY'S BEHAVIOR (pinned, not endorsed): in card-cloze.js the inner `function check()` shadows the
// `check = false` option, so every cloze card behaves like an immediate check: it shows the "Quick check"
// label and is never rated (Continue only, `rating: null`). Flagged in the Q02 PR for a behavior-change task.

test("cz: right first time → Continue only (see the note above), with blanks", () => {
  const c = mount(renderCz, { card: "cz:s1:0", sentence: sHave });
  assert.equal(c.inputs().length, 1);
  assert.equal(c.root.querySelector(".muted").textContent, "Quick check · not scored, the real test is tomorrow");
  assert.deepEqual(c.spoken, [], "no audio before answering");
  c.type("Am");
  c.tap("Check");
  assert.ok(hasContinueOnly(c));
  assert.equal(c.inputs()[0].readOnly, true);
  assert.deepEqual(c.spoken, ["Am o problemă."]);
  assert.deepEqual(finishWith(c, "Continue"), {
    result: "correct", usedHint: false, attemptNo: 1, rating: null, blanks: [{ tokenIndex: 0, ok: true }],
  });
});

test("cz: an empty Check does nothing; Enter checks", () => {
  const c = mount(renderCz, { card: "cz:s1:0", sentence: sHave });
  c.tap("Check");
  assert.ok(c.labels().includes("Check"), "still asking");
  c.type("Am");
  c.enter();
  assert.ok(hasContinueOnly(c));
  assert.equal(finishWith(c, "Continue").attemptNo, 1);
});

test("cz: right after a retry → Continue, attempt 2, no rating", () => {
  const c = mount(renderCz, { card: "cz:s1:0", sentence: sHave });
  c.type("Ai");
  c.tap("Check");
  assert.equal(c.root.querySelector(".feedback-slot").textContent, "Not quite. Try once more.");
  assert.equal(c.inputs()[0].selectCount, 1);
  assert.deepEqual(c.results, []);
  c.type("Am");
  c.tap("Check");
  assert.ok(hasContinueOnly(c));
  assert.deepEqual(finishWith(c, "Continue"), {
    result: "correct", usedHint: false, attemptNo: 2, rating: null, blanks: [{ tokenIndex: 0, ok: true }],
  });
});

test("cz: wrong twice → wrong, attempt 2", () => {
  const c = mount(renderCz, { card: "cz:s1:0", sentence: sHave });
  c.type("Ai");
  c.tap("Check");
  c.type("Are");
  c.tap("Check");
  assert.ok(hasContinueOnly(c));
  assert.ok(c.inputs()[0].classList.contains("bad"));
  assert.deepEqual(finishWith(c, "Continue"), {
    result: "wrong", usedHint: false, attemptNo: 2, rating: null, blanks: [{ tokenIndex: 0, ok: false }],
  });
});

test("cz: a hint shows first letters and takes the rating away", () => {
  const c = mount(renderCz, { card: "cz:s1:0", sentence: sHave });
  c.tap("Hint");
  assert.equal(c.root.querySelector(".hint-line").textContent, "Hint: A…");
  c.type("Am");
  c.tap("Check");
  assert.ok(hasContinueOnly(c));
  assert.deepEqual(finishWith(c, "Continue"), {
    result: "correct", usedHint: true, attemptNo: 1, rating: null, blanks: [{ tokenIndex: 0, ok: true }],
  });
});

test("cz: a diacritic slip is correct-diacritics on the first attempt", () => {
  const c = mount(renderCz, { card: "cz:s1:2", sentence: sHave });
  c.type("problema");
  c.tap("Check");
  const r = finishWith(c, "Continue");
  assert.equal(r.result, "correct-diacritics");
  assert.equal(r.attemptNo, 1);
});

test("cz check: several blanks, all right first time → Continue only (not scored)", () => {
  const c = mount(renderCz, { card: "cz:s1:0", sentence: sHave, check: true, blanks: [2, 0] });
  assert.equal(c.inputs().length, 2);
  assert.match(c.root.querySelector(".muted").textContent, /^Quick check · 2 new words · not scored/);
  c.type("Am", c.inputs()[0]);
  c.type("problemă", c.inputs()[1]);
  c.tap("Check");
  assert.ok(hasContinueOnly(c), "an immediate check is never rated");
  assert.deepEqual(finishWith(c, "Continue"), {
    result: "correct", usedHint: false, attemptNo: 1, rating: null,
    blanks: [{ tokenIndex: 0, ok: true }, { tokenIndex: 2, ok: true }],
  });
});

test("cz check: one blank wrong twice → wrong, the right blank is locked after the first try", () => {
  const c = mount(renderCz, { card: "cz:s1:0", sentence: sHave, check: true, blanks: [0, 2] });
  const [a, b] = c.inputs();
  c.type("Am", a);
  c.type("probleme", b);
  c.tap("Check");
  assert.equal(c.root.querySelector(".feedback-slot").textContent, "Not quite: the marked word. Try once more.");
  assert.equal(a.readOnly, true);
  assert.equal(b.readOnly, false);
  assert.ok(b.classList.contains("bad"));
  c.type("problemele", b);
  c.tap("Check");
  assert.deepEqual(finishWith(c, "Continue"), {
    result: "wrong", usedHint: false, attemptNo: 2, rating: null,
    blanks: [{ tokenIndex: 0, ok: true }, { tokenIndex: 2, ok: false }],
  });
});

test("cz check: one blank on a single-blank check reads 'Quick check · not scored'", () => {
  const c = mount(renderCz, { card: "cz:s1:0", sentence: sHave, check: true, blanks: [0] });
  assert.match(c.root.querySelector(".muted").textContent, /^Quick check · not scored/);
});

// ---------- kf ----------

test("kf: right first time → rated; plays the example sentence", () => {
  const c = mount(renderKf, { card: "kf:avea:pres1sg", sentence: sHave });
  assert.equal(c.root.querySelector(".kf-lemma strong").textContent, "a avea");
  c.type("am");
  c.tap("Check");
  assert.ok(hasRating(c));
  assert.deepEqual(c.spoken, ["Am o problemă."]);
  assert.deepEqual(finishWith(c, "Medium"), { result: "correct", usedHint: false, attemptNo: 1, rating: "medium" });
});

test("kf: right after a retry → Continue, attempt 2", () => {
  const c = mount(renderKf, { card: "kf:avea:pres1sg" });
  c.type("are");
  c.tap("Check");
  assert.equal(c.root.querySelector(".feedback-slot").textContent, "Not quite. Try once more.");
  c.type("am");
  c.tap("Check");
  assert.deepEqual(c.spoken, ["am"], "no sentence: the form alone");
  assert.deepEqual(finishWith(c, "Continue"), { result: "correct", usedHint: false, attemptNo: 2, rating: null });
});

test("kf: wrong twice → wrong, plays the form", () => {
  const c = mount(renderKf, { card: "kf:avea:pres1sg", sentence: sHave });
  c.type("are");
  c.tap("Check");
  c.type("ai");
  c.tap("Check");
  assert.deepEqual(c.spoken, ["am"]);
  assert.deepEqual(finishWith(c, "Continue"), { result: "wrong", usedHint: false, attemptNo: 2, rating: null });
});

test("kf: hint used → Continue, usedHint", () => {
  const c = mount(renderKf, { card: "kf:avea:pres1sg" });
  c.tap("Hint");
  assert.equal(c.root.querySelector(".hint-line").textContent, "Hint: a…");
  c.type("am");
  c.tap("Check");
  assert.deepEqual(finishWith(c, "Continue"), { result: "correct", usedHint: true, attemptNo: 1, rating: null });
});

// ---------- xf / sb / er share the answer modes ----------

const PRODUCTION = [
  { name: "xf", render: renderXf, card: "xf:s2:1", sentence: sSprint, answer: "Ieri a terminat sprintul.", wrong: "Ieri am terminat sprintul.", words: ["Ieri", "a", "terminat", "sprintul."] },
  { name: "sb", render: renderSb, card: "sb:s2:1", sentence: sSprint, answer: "Ieri a terminat sprintul.", wrong: "Ieri am terminat sprintul.", words: ["Ieri", "a", "terminat", "sprintul."] },
  { name: "er", render: renderEr, card: "er:s1", sentence: sHave, answer: "Am o problemă.", wrong: "Are o problemă.", words: ["Am", "o", "problemă."] },
];
/** `er` also passes the diff it graded. */
const payload = (name, base, diff) => (name === "er" ? { ...base, diff } : base);
const okDiff = (words) => words.map((token) => ({ token, status: "ok" }));

for (const P of PRODUCTION) {
  const typed = (opts = {}) => mount(P.render, { card: P.card, sentence: P.sentence, settings: { answerMode: "type" }, ...opts });

  test(`${P.name} type: right first time → rated`, () => {
    const c = typed();
    c.type(P.answer);
    c.tap("Check");
    assert.ok(hasRating(c));
    const r = finishWith(c, "Easy");
    assert.deepEqual(r, payload(P.name, { result: "correct", usedHint: false, attemptNo: 1, rating: "easy" }, r.diff));
    if (P.name === "er") assert.deepEqual(r.diff.map((d) => d.status), ["ok", "ok", "ok"]);
  });

  test(`${P.name} type: right after a retry → Continue, attempt 2`, () => {
    const c = typed();
    c.type(P.wrong);
    c.tap("Check");
    assert.equal(c.root.querySelector(".feedback-slot").textContent, "Not quite. Try once more.");
    assert.deepEqual(c.results, []);
    c.type(P.answer);
    c.enter();
    assert.ok(hasContinueOnly(c));
    const r = finishWith(c, "Continue");
    assert.deepEqual(r, payload(P.name, { result: "correct", usedHint: false, attemptNo: 2, rating: null }, r.diff));
  });

  test(`${P.name} type: wrong twice → wrong, attempt 2`, () => {
    const c = typed();
    c.type(P.wrong);
    c.tap("Check");
    c.type(P.wrong);
    c.tap("Check");
    assert.ok(hasContinueOnly(c));
    const r = finishWith(c, "Continue");
    assert.deepEqual(r, payload(P.name, { result: "wrong", usedHint: false, attemptNo: 2, rating: null }, r.diff));
    if (P.name === "er") assert.ok(r.diff.some((d) => d.status === "wrong"));
  });

  test(`${P.name} type: hint used → Continue, usedHint`, () => {
    const c = typed();
    c.tap("Hint");
    assert.match(c.root.querySelector(".hint-line").textContent, /^Hint: /);
    c.type(P.answer);
    c.tap("Check");
    assert.ok(hasContinueOnly(c));
    const r = finishWith(c, "Continue");
    assert.deepEqual(r, payload(P.name, { result: "correct", usedHint: true, attemptNo: 1, rating: null }, r.diff));
  });

  test(`${P.name} speak (the default): Reveal, no taps → correct and rated`, () => {
    const c = mount(P.render, { card: P.card, sentence: P.sentence, settings: { autoplay: false } });
    assert.equal(c.inputs().length, 0);
    c.tap("Reveal");
    const words = c.root.querySelectorAll(".speak-word");
    assert.deepEqual(words.map((w) => w.textContent), P.words);
    c.tap("All right");
    assert.ok(hasRating(c));
    const r = finishWith(c, "Medium");
    assert.deepEqual(r, payload(P.name, { result: "correct", usedHint: false, attemptNo: 1, rating: "medium" }, okDiff(P.words)));
  });

  test(`${P.name} speak: tapping a word → wrong, Continue, attempt 1`, () => {
    const c = mount(P.render, { card: P.card, sentence: P.sentence, settings: { autoplay: false } });
    c.tap("Reveal");
    const words = c.root.querySelectorAll(".speak-word");
    words[1].click();
    assert.equal(words[1].getAttribute("aria-pressed"), "true");
    words[2].click();
    words[2].click(); // untapped again
    c.tap("Done");
    assert.ok(hasContinueOnly(c));
    const diff = P.words.map((token, i) => ({ token, status: i === 1 ? "wrong" : "ok" }));
    assert.deepEqual(finishWith(c, "Continue"), payload(P.name, { result: "wrong", usedHint: false, attemptNo: 1, rating: null }, diff));
  });

  test(`${P.name} tiles: building the sentence from tiles → result from the check`, () => {
    const c = mount(P.render, { card: P.card, sentence: P.sentence, settings: { answerMode: "tiles" } });
    const target = P.words.map((w) => w.toLowerCase().replace(/[.!?]$/, ""));
    for (const w of target) c.root.querySelectorAll(".tile-bank .tile").find((t) => t.textContent === w).click();
    assert.deepEqual(c.root.querySelectorAll(".tile-line .tile").map((t) => t.textContent), target);
    c.tap("Check");
    assert.ok(hasRating(c));
    const r = finishWith(c, "Easy");
    assert.notEqual(r.result, "wrong");
    assert.deepEqual(r, payload(P.name, { result: r.result, usedHint: false, attemptNo: 1, rating: "easy" }, r.diff));
  });

  test(`${P.name}: switching the answer mode saves it, and is locked once answering started`, () => {
    const c = typed();
    c.tap("Tiles");
    assert.deepEqual(c.settingsPatches, [{ answerMode: "tiles" }]);
    assert.ok(c.root.querySelector(".tile-builder"));
    c.tap("Type");
    assert.deepEqual(c.settingsPatches, [{ answerMode: "tiles" }, { answerMode: "type" }]);
    c.type(P.wrong);
    c.tap("Check");
    c.tap("Say it");
    assert.equal(c.settingsPatches.length, 2, "no switch after the first check");
  });
}

test("er: a composite label is shown; audio stays hidden until answered", () => {
  const c = mount(renderEr, { card: "er:s1", sentence: sHave, label: "Review · 2 forms", settings: { answerMode: "type" } });
  assert.equal(c.root.querySelector("p.muted").textContent, "Review · 2 forms · say it in Romanian");
  assert.equal(c.root.querySelector(".audio-row").children.length, 0);
  assert.deepEqual(c.spoken, []);
  c.type("Am o problemă.");
  c.tap("Check");
  assert.equal(c.root.querySelector(".audio-row").children.length, 1);
  assert.deepEqual(c.spoken, ["Am o problemă."]);
});

test("xf autoplays the source sentence; sb does not", () => {
  assert.deepEqual(mount(renderXf, { card: "xf:s2:1", sentence: sSprint }).spoken, ["Ieri am terminat sprintul."]);
  assert.deepEqual(mount(renderSb, { card: "sb:s2:1", sentence: sSprint }).spoken, []);
});

// ---------- paradigm ----------

test("paradigm: one row per member, Continue → correct, attempt 1, no rating", () => {
  const c = mount(renderPg, { members: ["p1", "p2", "p3"] });
  const rows = c.root.querySelectorAll(".paradigm-row");
  assert.equal(rows.length, 3);
  assert.equal(rows[1].querySelector("mark").textContent, "Locuiești");
  assert.deepEqual(c.spoken, ["El locuiește în Cluj."]);
  assert.ok(hasContinueOnly(c));
  assert.deepEqual(finishWith(c, "Continue"), { result: "correct", usedHint: false, attemptNo: 1, rating: null });
});
