// Q02: characterization tests for the session view (`ui/views/session.js`). They drive whole sessions through
// the real card views on the fake DOM and pin what happens today, so Q05, Q08, Q13 can rewrite safely.
import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./helpers/fake-dom.mjs";
import { makeContent, sentence, state, NOW } from "./helpers/mini-content.mjs";
import { newCard } from "../app/js/core/fsrs.js";
import { nextDayStart, dayKey } from "../app/js/core/session.js";

installFakeDom();
const { render } = await import("../app/js/ui/views/session.js");

// Six two-word sentences `a<i> b<i>`; the first token of each is a cloze.
const u = (lex) => ({ lex, form: "base" });
const sents = Array.from({ length: 6 }, (_, i) => sentence(`s${i}`, `a${i} b${i}`, [u(`a${i}`), u(`b${i}`)], { en: `e${i}` }));
const lexemes = sents.flatMap((_, i) => ["a", "b"].map((p) => ({ id: `${p}${i}`, lemma: `${p}${i}`, pos: "noun", gloss: "g", forms: { base: `${p}${i}` } })));
lexemes.find((l) => l.id === "a3").keyForms = ["base"]; // for the kf test
const content = makeContent(sents, lexemes);

const due = (st, id, ago) => { st.cards[id] = { ...newCard(NOW - 86400000), due: NOW - ago }; };

beforeEach(() => {
  mock.timers.enable({ apis: ["Date", "setTimeout"], now: NOW });
  let i = 0;
  const vals = [0.5, 0.1, 0.9, 0.3, 0.7];
  mock.method(Math, "random", () => vals[i++ % vals.length]);
  document.getElementById("toasts").replaceChildren();
});
afterEach(() => {
  mock.timers.reset();
  mock.restoreAll();
});

function start(st, params = { mode: "quick" }) {
  const root = document.createElement("div");
  document.body.append(root);
  const saves = [];
  const ctx = {
    state: st,
    content,
    route: { params },
    store: { save: (s) => saves.push(s), flush: () => { ctx.flushes++; } },
    update(fn) { ctx.state = fn(ctx.state); ctx.store.save(ctx.state); return ctx.state; },
    updateSettings(patch) { return ctx.update((s) => ({ ...s, settings: { ...s.settings, ...patch } })); },
    flushes: 0,
    tts: { speak: () => Promise.resolve() },
    navigate: (h) => navs.push(h),
  };
  const navs = [];
  const cleanup = render(root, ctx);
  const labels = () => root.querySelectorAll("button").map((b) => b.textContent);
  const tap = (label) => {
    const b = root.querySelectorAll("button").find((x) => x.textContent === label);
    assert.ok(b, `no "${label}" button; have: ${labels().join(" | ")}`);
    b.click();
  };
  const card = () => root.querySelector("[data-card] section");
  const kind = () => card()?.className.replace(/^card /, "") ?? null;
  const isSummary = () => root.querySelector("h1")?.textContent === "Done!";
  /** lr: pick the right (or a wrong) option, then Continue. */
  const answerLr = (right = true) => {
    const want = card().dataset.card.slice(3);
    root.querySelectorAll(".option").find((b) => (b.dataset.id === want) === right).click();
    tap("Continue");
  };
  /** cz: type into every blank and check, `times` times, then Continue. */
  const answerCz = (text, times = 1) => {
    for (let k = 0; k < times; k++) {
      for (const input of root.querySelectorAll("[data-card] input")) input.value = text;
      tap("Check");
    }
    tap("Continue");
  };
  return { root, ctx, saves, navs, cleanup, labels, tap, card, kind, isSummary, answerLr, answerCz };
}

test("a Quick queue of due cards reaches the summary, saving and flushing on the way", () => {
  const st = state();
  due(st, "lr:s0", 1000);
  due(st, "lr:s1", 2000);
  due(st, "lr:s2", 3000);
  const s = start(st);
  const seen = [];
  for (let k = 0; k < 3; k++) {
    assert.equal(s.kind(), "card-lr");
    seen.push(s.card().dataset.card);
    s.answerLr(true);
  }
  assert.deepEqual(seen, ["lr:s2", "lr:s1", "lr:s0"], "most overdue first");
  assert.ok(s.isSummary(), "summary shown");
  assert.equal(s.root.querySelector('[data-n="cards"]').textContent, "3");
  assert.equal(s.root.querySelector('[data-n="correct"]').textContent, "3");
  assert.equal(s.saves.length, 3 + 1, "one save per card, one at the end");
  assert.equal(s.ctx.flushes, 1);
  assert.ok(Object.values(s.ctx.state.history).length, "the day is recorded");
  // Leaving after the summary records nothing more.
  s.cleanup();
  assert.equal(s.saves.length, 4);
  assert.equal(s.ctx.flushes, 2);
});

test("the session bar shows how many cards are done out of the queue", () => {
  const st = state();
  due(st, "lr:s0", 1000);
  due(st, "lr:s1", 2000);
  const s = start(st);
  const count = () => s.root.querySelector(".progress-count").textContent;
  assert.equal(count(), "0/2");
  s.answerLr(true);
  assert.equal(count(), "1/2");
  assert.equal(s.root.querySelector(".progress").getAttribute("aria-valuetext"), "1 of 2 done");
});

test("nothing advances by itself: the session waits on each card", () => {
  const st = state();
  due(st, "lr:s0", 1000);
  const s = start(st);
  const opt = s.root.querySelectorAll(".option").find((b) => b.dataset.id === "s0");
  opt.click();
  mock.timers.tick(10 * 60 * 1000);
  assert.equal(s.kind(), "card-lr", "still on the card");
  assert.equal(s.saves.length, 0);
  s.tap("Continue");
  assert.ok(s.isSummary());
});

test("Again (wrong) requeues a card once, then puts it on the difficult list", () => {
  const st = state();
  due(st, "lr:s0", 1000);
  due(st, "lr:s1", 2000);
  const s = start(st);
  const order = [];
  order.push(s.card().dataset.card);
  s.answerLr(false); // lr:s1 wrong → back later
  assert.equal(s.ctx.state.difficult["lr:s1"], undefined);
  order.push(s.card().dataset.card);
  s.answerLr(true); // lr:s0
  order.push(s.card().dataset.card);
  s.answerLr(false); // lr:s1 again, wrong again → difficult
  assert.deepEqual(order, ["lr:s1", "lr:s0", "lr:s1"]);
  assert.ok(s.isSummary());
  assert.equal(s.ctx.state.difficult["lr:s1"], NOW);
  assert.equal(s.root.querySelector('[data-n="difficult"]').textContent, "1 card");
  assert.equal(s.root.querySelector('[data-n="cards"]').textContent, "3");
});

test("Hard on a rated card requeues it once, then puts it on the difficult list", () => {
  const st = state();
  st.lexemeSentences = { a3: ["s3", "s9"] }; // unlocks a3's key forms
  due(st, "kf:a3:base", 1000);
  const s = start(st);
  for (let k = 0; k < 2; k++) {
    assert.equal(s.kind(), "card-keyform");
    s.root.querySelector("[data-card] input").value = "a3";
    s.tap("Check");
    s.tap("Hard");
  }
  assert.ok(s.isSummary());
  assert.equal(s.ctx.state.difficult["kf:a3:base"], NOW);
});

test("a form claimed mid-session skips its later fm card", () => {
  const build = () => {
    const st = state();
    st.seenSentences.s4 = NOW - 86400000;
    st.seenSentences.s5 = NOW - 86400000;
    due(st, "lr:s5", 2000);
    due(st, "fm:a5:base", 1000);
    return st;
  };
  // Without a claim the fm card is shown (as a cloze in a seen sentence).
  const plain = start(build());
  assert.equal(plain.card().dataset.card, "lr:s5");
  plain.answerLr(true);
  assert.equal(plain.kind(), "card-cloze", "the fm card is shown");
  plain.cleanup();

  const s = start(build());
  s.root.querySelectorAll(".option").find((b) => b.dataset.id === "s5").click();
  const word = s.root.querySelectorAll(".feedback .tok-link").find((b) => b.textContent === "a5");
  assert.equal(word?.tag, "button", "feedback words are claimable buttons");
  word.click();
  const sheet = document.body.querySelector(".sheet");
  assert.ok(sheet, "the form sheet opens");
  assert.equal(sheet.querySelector("h2").textContent, "a5");
  const sheetBtn = (label) => sheet.querySelectorAll("button").find((b) => b.textContent === label);
  const savesBefore = s.saves.length;
  sheetBtn("I can produce this").click();
  assert.equal(s.ctx.state.claimed["a5.base"], NOW, "claimed");
  assert.equal(s.saves.length, savesBefore + 1, "a claim saves");
  sheetBtn("Claimed ✓ · Undo").click();
  assert.ok(!("a5.base" in s.ctx.state.claimed), "undo unclaims");
  sheetBtn("I can produce this").click();
  sheetBtn("Close").click();
  assert.equal(document.body.querySelector(".sheet"), null, "closed");
  s.tap("Continue");
  assert.ok(s.isSummary(), "the claimed fm card was skipped");
  assert.equal(s.root.querySelector('[data-n="cards"]').textContent, "1");
});

test("a wrong immediate check is asked once more at the end, and only once", () => {
  const st = state();
  st.settings.newItemsPerLearn = 2;
  const s = start(st, { mode: "learn" });
  const sid = s.card().dataset.card.slice(3);
  s.answerLr(true);
  assert.equal(s.kind(), "card-cloze");
  assert.match(s.card().querySelector(".muted").textContent, /^Quick check/);
  s.answerCz("zz", 2); // wrong twice
  assert.equal(s.kind(), "card-cloze", "asked again");
  assert.equal(s.ctx.state.cards[`fm:a${sid.slice(1)}:base`].due, nextDayStart(NOW), "the fm card is due tomorrow whatever the answer");
  s.answerCz("zz", 2); // wrong again: not asked a third time
  assert.ok(s.isSummary());
  assert.equal(s.root.querySelector('[data-n="cards"]').textContent, "3");
  assert.equal(s.root.querySelector('[data-n="correct"]').textContent, "1");
});

test("a right immediate check is not asked again", () => {
  const st = state();
  st.settings.newItemsPerLearn = 2;
  const s = start(st, { mode: "learn" });
  const sid = s.card().dataset.card.slice(3);
  s.answerLr(true);
  s.answerCz(`a${sid.slice(1)}`);
  assert.ok(s.isSummary());
  assert.equal(s.root.querySelector('[data-n="correct"]').textContent, "2");
});

test("leaving mid-session keeps the started sentence's forms, records the session and saves once more", () => {
  const st = state();
  st.settings.newItemsPerLearn = 2;
  const s = start(st, { mode: "learn" });
  const fm = `fm:a${s.card().dataset.card.slice(4)}:base`;
  s.answerLr(true);
  assert.equal(s.kind(), "card-cloze", "the check is next");
  assert.equal(s.ctx.state.cards[fm], undefined);
  mock.timers.tick(3 * 60000);
  const saves = s.saves.length;
  s.cleanup();
  assert.equal(s.saves.length, saves + 1, "one more save");
  assert.equal(s.ctx.flushes, 1);
  assert.equal(s.ctx.state.cards[fm].due, nextDayStart(NOW + 3 * 60000), "keepStarted made the fm card");
  const day = s.ctx.state.history[dayKey(NOW + 3 * 60000)];
  assert.equal(day.newItems, 1, "recordSession counted the new sentence");
  assert.ok(day.minutes >= 3, "the time is counted");
  assert.equal(document.getElementById("toasts").textContent, "Session ended. Your 1 answer is saved.");
  assert.deepEqual(s.ctx.state.pace, st.pace, "a session left early never resizes the Learn batch");
});

test("the × button navigates home; the empty state shows when nothing is due", () => {
  const st = state();
  due(st, "lr:s0", 1000);
  const s = start(st);
  s.tap("×");
  assert.deepEqual(s.navs, ["#/home"]);
  const empty = start(state(), { mode: "review" });
  assert.equal(empty.root.querySelector("p.muted").textContent, "Nothing is due. Nice work.");
  const focused = start(state(), { mode: "review", f: "situation:nowhere" });
  assert.equal(focused.root.querySelector("p.muted").textContent, "Nothing in this focus right now. Clear the focus on Home or pick another topic.");
});
