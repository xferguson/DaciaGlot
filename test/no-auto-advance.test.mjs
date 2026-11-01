// Owner preference (docs/EXPERIMENTS.md, Owner preferences): no card ever moves on by itself.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const files = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? files(p) : p.endsWith(".js") ? [p] : [];
});

test("no UI code auto-advances: no autoAdvance option and no programmatic button clicks", () => {
  for (const p of files("app/js/ui")) {
    const src = readFileSync(p, "utf8");
    assert.doesNotMatch(src, /autoAdvance/, `${p} mentions autoAdvance`);
    // The only programmatic click allowed is the export download link and the hidden file input in Settings.
    if (!p.endsWith("settings.js")) assert.doesNotMatch(src, /\.click\(\)/, `${p} clicks a button by itself`);
  }
});

test("the stored settings carry no autoAdvance default", async () => {
  const { defaultState } = await import("../app/js/data/store.js");
  assert.equal("autoAdvance" in defaultState(0).settings, false);
});
