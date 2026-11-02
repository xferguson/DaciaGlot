import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { emptyDay, bumpDay, addMinutes } from "../app/js/core/history.js";
import * as session from "../app/js/core/session.js";
import { recordSession } from "../app/js/core/pace.js";
import { dayKey } from "../app/js/core/time.js";

const now = new Date(2026, 10, 2, 12).getTime();

test("emptyDay lists every counter at zero", () => {
  assert.deepEqual(emptyDay(), { minutes: 0, cards: 0, newSentences: 0, formsProduced: 0, newItems: 0 });
  assert.notEqual(emptyDay(), emptyDay());
});

test("bumpDay returns a new history and hands fn a copy", () => {
  const history = { [dayKey(now)]: { ...emptyDay(), cards: 2 } };
  const before = JSON.stringify(history);
  const out = bumpDay(history, now, (d) => { d.cards += 1; });
  assert.equal(JSON.stringify(history), before);
  assert.equal(out[dayKey(now)].cards, 3);
  assert.deepEqual(bumpDay({}, now, () => {})[dayKey(now)], emptyDay());
});

test("bumpDay keeps old records that lack newer fields", () => {
  const out = bumpDay({ [dayKey(now)]: { minutes: 1, cards: 1, newSentences: 0, formsProduced: 0 } }, now, () => {});
  assert.equal(out[dayKey(now)].newItems, 0);
});

test("addMinutes is shared with session.js", () => {
  assert.equal(session.addMinutes, addMinutes);
  const s = addMinutes({ history: {} }, 2.5, now);
  assert.equal(s.history[dayKey(now)].minutes, 2.5);
});

test("recordSession adds newItems to today", () => {
  const s = recordSession({ history: {}, settings: {} }, { pace: { newForms: 2, newSentences: 1 }, accuracy: null, learn: false, now });
  assert.equal(s.history[dayKey(now)].newItems, 3);
});

test("core modules have no import cycle", () => {
  const dir = new URL("../app/js/core/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".js"));
  const graph = new Map(files.map((f) => [f, [...readFileSync(new URL(f, dir), "utf8").matchAll(/^(?:import|export)\s[^;]*?from\s+"\.\/([\w-]+\.js)"/gms)].map((m) => m[1])]));
  const state = new Map();
  const walk = (f, path) => {
    if (state.get(f) === 1) assert.fail(`cycle: ${[...path, f].join(" -> ")}`);
    if (state.get(f) === 2) return;
    state.set(f, 1);
    for (const g of graph.get(f) ?? []) walk(g, [...path, f]);
    state.set(f, 2);
  };
  for (const f of files) walk(f, []);
});
