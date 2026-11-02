// Q05: the pure answer reducer and hintFor. No DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { answerStep, initialAnswer, canRate } from "../app/js/core/answer.js";
import { hintFor } from "../app/js/core/check.js";

const run = (events, mode) => events.reduce((acc, e) => {
  const r = answerStep(acc.state, e);
  return { state: r.state, effects: [...acc.effects, r.effect] };
}, { state: initialAnswer(mode), effects: [] });

test("a correct first try finishes and may be rated", () => {
  const { state, effects } = run([{ type: "check", result: "correct" }]);
  assert.deepEqual(effects, ["finish"]);
  assert.equal(canRate(state, "correct"), true);
});

test("a wrong first try retries; a second wrong finishes without a rating", () => {
  const { state, effects } = run([{ type: "check", result: "wrong" }, { type: "check", result: "wrong" }]);
  assert.deepEqual(effects, ["retry", "finish"]);
  assert.equal(state.attempts, 2);
  assert.equal(canRate(state, "wrong"), false);
});

test("a correct second try or a hint blocks rating", () => {
  const second = run([{ type: "check", result: "wrong" }, { type: "check", result: "correct" }]);
  assert.equal(canRate(second.state, "correct"), false);
  const hinted = run([{ type: "hint" }, { type: "check", result: "correct" }]);
  assert.equal(canRate(hinted.state, "correct"), false);
});

test("spoke ends the card as one attempt", () => {
  const { state, effects } = run([{ type: "spoke" }]);
  assert.deepEqual(effects, ["finish"]);
  assert.equal(state.attempts, 1);
  assert.equal(canRate(state, "correct"), true);
});

test("mode changes only before the first try and never after finishing", () => {
  assert.equal(run([{ type: "mode", mode: "type" }], "speak").state.mode, "type");
  assert.equal(run([{ type: "check", result: "wrong" }, { type: "mode", mode: "type" }], "speak").state.mode, "speak");
  assert.equal(run([{ type: "spoke" }, { type: "check", result: "wrong" }]).effects[1], "none");
});

test("answerStep does not mutate its input", () => {
  const s = initialAnswer();
  answerStep(s, { type: "check", result: "wrong" });
  assert.deepEqual(s, initialAnswer());
});

test("hintFor gives the first letter of each wrong or missing token", () => {
  assert.equal(hintFor("", "terminat"), "t…");
  assert.equal(hintFor("terminat", "terminat"), "");
  assert.equal(hintFor("am", "am terminat"), "t…");
});
