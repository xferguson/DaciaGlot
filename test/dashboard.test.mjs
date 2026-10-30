import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { indexContent, packPaths } from "../app/js/data/content.js";
import { levelProgress, allPatternStates, sentenceMastered, masteredSentenceIds } from "../app/js/core/mastery.js";
import { dayKey } from "../app/js/core/session.js";
import { defaultState } from "../app/js/data/store.js";
import { currentLevelId, dashboardModel, productionStats, weeklyHistory, dueForecast, patternTrend, WEEKS, FORECAST_DAYS } from "../app/js/ui/views/dashboard.js";
import { niceMax } from "../app/js/ui/components/chart.js";
import { arcLength } from "../app/js/ui/components/ring.js";

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 29, 12);
const read = (p) => JSON.parse(readFileSync(new URL(`../app/content/${p}`, import.meta.url), "utf8"));

function loadReal() {
  const manifest = read("manifest.json");
  const paths = packPaths(manifest);
  return indexContent({
    manifest,
    patterns: read("patterns.json"),
    lexemes: paths.lexemes.flatMap(read),
    sentences: paths.sentences.flatMap(read),
    levels: manifest.levels.map((id) => read(`levels/${id}.json`)),
  });
}

/** Deterministic 3-month state: ~150 sentences seen over 90 days, cz attempts, one fm card per cloze unit, daily history. */
function fixture(content) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
  const state = defaultState(NOW - 90 * DAY);
  const ids = [...content.sentences.keys()].slice(0, 150);
  ids.forEach((id, i) => {
    const t0 = NOW - 90 * DAY + Math.floor((i / ids.length) * 85 * DAY);
    const s = content.sentences.get(id);
    state.seenSentences[id] = t0;
    state.cards[`lr:${id}`] = { due: t0 + DAY, stability: 3, difficulty: 5, reps: 2, lapses: 0, state: 2, step: 0, lastReview: t0 };
    s.tokens.forEach((tok, ti) => {
      if (!tok.cloze) return;
      const stability = 2 + rnd() * 40;
      const fm = { due: NOW + Math.floor((rnd() * 30 - 5) * DAY), stability, difficulty: 5, reps: 4, lapses: 0, state: 2, step: 0, lastReview: t0 };
      for (const u of tok.units) state.cards[`fm:${u.lex}:${u.form}`] ??= fm;
      for (let k = 0; k < 4; k++) {
        const t = t0 + k * 9 * DAY;
        if (t > NOW) break;
        const c = rnd() < 0.85 ? 1 : 0;
        for (const u of tok.units) {
          state.attempts.push({ u: `${u.lex}.${u.form}`, lx: u.lex, c, t, card: `cz:${id}:${ti}` });
          if (u.pattern) state.attempts.push({ u: `pat:${u.pattern}`, lx: u.lex, c, t, card: `cz:${id}:${ti}` });
        }
      }
    });
  });
  for (let d = 0; d < 90; d++) {
    state.history[dayKey(NOW - d * DAY)] = { minutes: 5 + (d % 7), cards: 20, newSentences: 2, formsProduced: d % 4 };
  }
  return state;
}

const content = loadReal();
const state = fixture(content);

test("numbers match mastery.js for the 3-month fixture", () => {
  const m = dashboardModel(state, content, NOW);
  for (const id of content.levels.keys()) assert.deepEqual(m.levels[id], levelProgress(id, state, content, NOW));
  assert.deepEqual(m.patternStates, allPatternStates(state, content, NOW));
  const mastered = [...content.sentences.keys()].filter((id) => sentenceMastered(id, state, content, NOW)).length;
  assert.equal(m.stats.sentencesMastered, mastered);
  assert.deepEqual([...masteredSentenceIds(state, content, NOW)].sort(), [...content.sentences.keys()].filter((id) => sentenceMastered(id, state, content, NOW)).sort());
  assert.ok(mastered > 0 && m.stats.formsAll > 0);
});

test("model builds in under 100 ms", () => {
  dashboardModel(state, content, NOW); // warm up
  const times = Array.from({ length: 3 }, () => {
    const t = performance.now();
    dashboardModel(state, content, NOW);
    return performance.now() - t;
  });
  const best = Math.min(...times);
  console.log(`dashboardModel: ${best.toFixed(1)} ms (best of 3)`);
  assert.ok(best < 100, `${best} ms`);
});

test("productionStats: distinct correct forms, week window, folded aggregates", () => {
  const att = (u, c, t) => ({ u, lx: u.split(".")[0], c, t, card: "cz:s:0" });
  const s = {
    ...defaultState(NOW),
    attempts: [att("a.x", 1, NOW - DAY), att("a.x", 1, NOW - 2 * DAY), att("b.y", 1, NOW - 20 * DAY), att("c.z", 0, NOW - DAY), att("pat:p", 1, NOW - DAY)],
    unitAggregates: { "d.w": { n: 3, correct: 2, lexemes: [], lastCorrectAt: 0 }, "e.v": { n: 3, correct: 0, lexemes: [], lastCorrectAt: 0 } },
  };
  assert.deepEqual(productionStats(s, content, NOW), { formsAll: 3, formsWeek: 1, sentencesMastered: 0, wordsKnown: 3 });
});

test("weeklyHistory sums rolling weeks, oldest first", () => {
  const s = { ...defaultState(NOW), history: {
    [dayKey(NOW)]: { minutes: 5, formsProduced: 2 },
    [dayKey(NOW - 6 * DAY)]: { minutes: 1, formsProduced: 1 },
    [dayKey(NOW - 7 * DAY)]: { minutes: 10, formsProduced: 4 },
  } };
  const w = weeklyHistory(s, NOW);
  assert.equal(w.length, WEEKS);
  assert.deepEqual([w[WEEKS - 1].minutes, w[WEEKS - 1].forms], [6, 3]);
  assert.deepEqual([w[WEEKS - 2].minutes, w[WEEKS - 2].forms], [10, 4]);
});

test("dueForecast: overdue counts today, beyond 14 days dropped", () => {
  const card = (due) => ({ due, stability: 1, difficulty: 5, reps: 1, lapses: 0, state: 2, step: 0, lastReview: null });
  const s = { ...defaultState(NOW), cards: { a: card(NOW - 5 * DAY), b: card(NOW), c: card(NOW + 3 * DAY), d: card(NOW + 40 * DAY) } };
  const f = dueForecast(s, NOW);
  assert.equal(f.length, FORECAST_DAYS);
  assert.equal(f.reduce((n, d) => n + d.value, 0), 3);
  assert.ok(f[0].value >= 2);
});

test("patternTrend: weekly accuracy with gaps", () => {
  const att = (c, t) => ({ u: "pat:p", lx: "a", c, t, card: "cz:s:0" });
  const s = { ...defaultState(NOW), attempts: [att(1, NOW - DAY), att(0, NOW - 2 * DAY), att(1, NOW - 15 * DAY)] };
  const t = patternTrend("p", s, NOW);
  assert.equal(t.length, WEEKS);
  assert.equal(t[WEEKS - 1].value, 50);
  assert.equal(t[WEEKS - 2].value, null);
  assert.equal(t[WEEKS - 3].value, 100);
});

test("currentLevelId, niceMax, arcLength", () => {
  assert.equal(currentLevelId({ A1: { complete: true }, A2: { complete: false } }), "A2");
  assert.equal(currentLevelId({ A1: { complete: true } }), "A1");
  assert.equal(currentLevelId({}), null);
  assert.deepEqual([0, 3, 7, 12, 40].map(niceMax), [1, 5, 10, 20, 50]);
  assert.ok(Math.abs(arcLength(50) - Math.PI * 42) < 1e-9);
  assert.equal(arcLength(150), arcLength(100));
});
