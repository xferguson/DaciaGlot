import { test } from "node:test";
import assert from "node:assert/strict";
import { DAY_MS, dayKey, startOfDayPlus } from "../app/js/core/time.js";
import * as session from "../app/js/core/session.js";

test("DAY_MS is one day", () => {
  assert.equal(DAY_MS, 24 * 60 * 60 * 1000);
});

test("dayKey is the local YYYY-MM-DD, zero-padded", () => {
  assert.equal(dayKey(new Date(2026, 0, 5, 0, 0, 0, 0).getTime()), "2026-01-05");
  assert.equal(dayKey(new Date(2026, 0, 5, 23, 59, 59, 999).getTime()), "2026-01-05");
  assert.equal(dayKey(new Date(2026, 11, 31, 12).getTime()), "2026-12-31");
  assert.equal(dayKey(new Date(2024, 1, 29, 8).getTime()), "2024-02-29");
});

test("startOfDayPlus: local midnight n days later, across month and year ends", () => {
  const at = (y, m, d, h = 0) => new Date(y, m, d, h).getTime();
  assert.equal(startOfDayPlus(at(2026, 4, 10, 15), 0), at(2026, 4, 10));
  assert.equal(startOfDayPlus(at(2026, 4, 10, 15), 1), at(2026, 4, 11));
  assert.equal(startOfDayPlus(at(2026, 0, 31, 9), 1), at(2026, 1, 1));
  assert.equal(startOfDayPlus(at(2026, 11, 31, 23), 1), at(2027, 0, 1));
  assert.equal(startOfDayPlus(at(2024, 1, 28, 6), 1), at(2024, 1, 29));
  assert.equal(startOfDayPlus(at(2025, 1, 28, 6), 1), at(2025, 2, 1));
  assert.equal(startOfDayPlus(at(2026, 11, 30, 6), 4), at(2027, 0, 3));
});

test("startOfDayPlus and dayKey across DST changes (EU and US dates)", () => {
  // Whatever the host TZ, the result is the local midnight built by new Date(y, m, d).
  for (const [y, m, d] of [[2026, 2, 29], [2026, 9, 25], [2026, 2, 8], [2026, 10, 1]]) {
    const before = new Date(y, m, d - 1, 12).getTime();
    assert.equal(startOfDayPlus(before, 1), new Date(y, m, d).getTime());
    assert.equal(startOfDayPlus(before, 2), new Date(y, m, d + 1).getTime());
    assert.equal(dayKey(startOfDayPlus(before, 1)), dayKey(new Date(y, m, d, 12).getTime()));
  }
});

test("session.js keeps nextDayStart and re-exports dayKey", () => {
  const now = new Date(2026, 11, 31, 18).getTime();
  assert.equal(session.nextDayStart(now), startOfDayPlus(now, 1));
  assert.equal(session.dayKey, dayKey);
});
