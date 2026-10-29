import { test } from "node:test";
import assert from "node:assert/strict";
import { diffPatternStates, formsProduced, exportReminderDue } from "../app/js/ui/views/summary.js";
import { NOW, state } from "./helpers/mini-content.mjs";

const DAY = 86400000;

test("diffPatternStates reports only changed patterns, sorted", () => {
  const before = { b: "seen", a: "not-started", c: "producing" };
  const after = { b: "producing", a: "not-started", c: "producing", d: "seen" };
  assert.deepEqual(diffPatternStates(before, after), [
    { id: "b", from: "seen", to: "producing" },
    { id: "d", from: "not-started", to: "seen" },
  ]);
  assert.deepEqual(diffPatternStates(after, after), []);
});

test("formsProduced counts distinct correct units since start", () => {
  const at = (u, c, t) => ({ u, lx: "x", c, t, card: "cz:s:0" });
  const attempts = [at("a.x", 1, NOW - 1), at("a.x", 1, NOW + 1), at("a.x", 1, NOW + 2), at("b.x", 0, NOW + 3), at("c.x", 1, NOW + 4)];
  assert.equal(formsProduced(attempts, NOW), 2);
});

const days = (n) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`2026-01-0${i + 1}`, { cards: 5 }]));

test("exportReminderDue: never exported", () => {
  assert.equal(exportReminderDue({ ...state(), history: days(2) }, NOW), false);
  assert.equal(exportReminderDue({ ...state(), history: days(3) }, NOW), true);
  assert.equal(exportReminderDue({ ...state(), history: { d: { cards: 0 }, ...days(2) } }, NOW), false);
});

test("exportReminderDue: appears after 14 days, clears on export", () => {
  const withExport = (t) => { const s = state(); s.settings.lastExportAt = t; return s; };
  assert.equal(exportReminderDue(withExport(NOW - 14 * DAY), NOW), false);
  assert.equal(exportReminderDue(withExport(NOW - 14 * DAY - 1), NOW), true);
  assert.equal(exportReminderDue(withExport(NOW), NOW), false);
});
