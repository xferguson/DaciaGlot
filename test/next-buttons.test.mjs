import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { installFakeDom } from "./helpers/fake-dom.mjs";

const root = installFakeDom();
const { nextButtons } = await import("../app/js/ui/components/feedback.js");

const setup = (opts) => {
  mock.timers.reset();
  mock.timers.enable({ apis: ["setTimeout"] });
  const actions = document.createElement("div");
  root.replaceChildren(actions);
  const picks = [];
  nextButtons(actions, { onPick: (r) => picks.push(r), ...opts });
  return { actions, picks, buttons: () => actions.querySelectorAll("button") };
};
const flush = async (ms) => { for (let i = 0; i < 5; i++) { await Promise.resolve(); mock.timers.tick(ms); } await Promise.resolve(); };

test("nothing ever advances by itself, however long it waits", async () => {
  for (const canRate of [true, false]) {
    const { picks } = setup({ canRate });
    await flush(60000);
    assert.deepEqual(picks, [], "must wait for the learner");
  }
  mock.timers.reset();
});

test("a pointerdown on a rating button does not change the layout before the click lands", () => {
  const { actions, picks, buttons } = setup({ canRate: true });
  const before = actions.children.length;
  const easy = buttons()[2];
  easy.dispatch("pointerdown");
  assert.equal(actions.children.length, before);
  easy.click();
  assert.deepEqual(picks, ["easy"]);
  mock.timers.reset();
});

test("every rating button fires exactly its rating", () => {
  for (const [i, r] of ["hard", "medium", "easy"].entries()) {
    const { buttons, picks } = setup({ canRate: true });
    buttons()[i].click();
    assert.deepEqual(picks, [r]);
  }
  mock.timers.reset();
});

test("a Continue whose action throws re-enables, so the learner is never stuck", () => {
  const errs = mock.method(console, "error", () => {});
  let calls = 0;
  const actions = document.createElement("div");
  root.replaceChildren(actions);
  nextButtons(actions, { canRate: false, onPick: () => { calls++; if (calls === 1) throw new Error("boom"); } });
  const go = actions.querySelectorAll("button")[0];
  go.click();
  assert.equal(go.disabled, false, "re-enabled after the failure");
  go.click();
  assert.equal(calls, 2, "a second tap runs again");
  assert.equal(go.disabled, true, "disabled once it has moved on");
  errs.mock.restore();
});

test("a double tap on Continue fires once", () => {
  const { buttons, picks } = setup({ canRate: false });
  buttons()[0].click();
  buttons()[0].click();
  assert.deepEqual(picks, [null]);
  mock.timers.reset();
});
