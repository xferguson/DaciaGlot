import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { requeueWrong } from "../app/js/core/session.js";
import { tileOptions } from "../app/js/core/cards.js";
import { pickCarrier, pickComposite } from "../app/js/core/carrier.js";

const dir = new URL("../app/js/core/", import.meta.url);
const FORBIDDEN = [/Math\.random/, /Date\.now/, /new Date\(\s*\)/, /\bdocument\b/, /\bwindow\b/, /\blocalStorage\b/, /\bnavigator\b/];

const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

test("core/*.js uses no ambient time, randomness or browser globals", () => {
  const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
  assert.ok(files.length > 5);
  for (const f of files) {
    const src = stripComments(readFileSync(new URL(f, dir), "utf8"));
    for (const re of FORBIDDEN) assert.ok(!re.test(src), `${f} uses ${re}`);
  }
});

test("rng is required where it used to default to Math.random", () => {
  assert.throws(() => tileOptions({ tokens: [] }, {}), TypeError);
  assert.throws(() => pickCarrier("u", {}, {}, { now: 0 }), TypeError);
  assert.throws(() => pickComposite([], {}, {}, 0), TypeError);
});

const deepFreeze = (o) => { if (o && typeof o === "object" && !Object.isFrozen(o)) { Object.freeze(o); Object.values(o).forEach(deepFreeze); } return o; };

test("requeueWrong does not mutate its arguments", () => {
  const queue = deepFreeze(Array.from({ length: 8 }, (_, i) => ({ cardId: `lr:s0${i}`, isNew: false })));
  const r = requeueWrong(queue, 1, queue[1], () => 0);
  assert.equal(queue.length, 8);
  assert.equal(r.queue.length, 9);
  assert.equal(r.queue[r.at].cardId, "lr:s01");
});
