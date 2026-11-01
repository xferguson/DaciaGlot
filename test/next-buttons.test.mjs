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

test("bug 1: a rating screen never auto-advances before the learner picks", async () => {
  const { picks } = setup({ canRate: true, autoAdvance: { after: Promise.resolve() } });
  await flush(20000);
  assert.deepEqual(picks, [], "must wait for Hard/Medium/Easy");
  mock.timers.reset();
});

test("bug 2: a pointerdown on the card does not remove or move the rating buttons' neighbours before the click lands", async () => {
  const { actions, picks, buttons } = setup({ canRate: true, autoAdvance: { after: Promise.resolve() } });
  const before = actions.children.length;
  const easy = buttons()[2];
  easy.dispatch("pointerdown"); // finger down: layout must not change under it
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

test("Continue (no rating) still auto-advances when asked to", async () => {
  const { picks } = setup({ canRate: false, autoAdvance: { after: Promise.resolve() } });
  await flush(20000);
  assert.deepEqual(picks, [null]);
  mock.timers.reset();
});
