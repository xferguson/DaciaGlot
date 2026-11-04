// Progress dashboard (PRD FR-P5, P-6): production is the measure. Sections in FR-P5 order.
import { levelProgress, allPatternStates, masteredSentenceIds } from "../../core/mastery.js";
import { dayKey, DAY_MS as DAY } from "../../core/time.js";
import { weeklyIntake } from "../../core/pace.js";
import { calibrationSummary } from "../../core/calibrate.js";
import { parseUnitId, isPatternUnit } from "../../core/unit-id.js";

export const WEEKS = 8;
export const FORECAST_DAYS = 14;

/** The level to show on Home: the first one not yet complete, else the last. `progress` is `{levelId: levelProgress}`. */
export function currentLevelId(progress) {
  const ids = Object.keys(progress);
  return ids.find((id) => !progress[id].complete) ?? ids[ids.length - 1] ?? null;
}

/** Rolling week index (0 = the 7 days ending `now`) for a timestamp, or -1 when outside the last `WEEKS`. */
function weekIndex(t, now) {
  const w = Math.floor((now - t) / (7 * DAY));
  return t <= now && w >= 0 && w < WEEKS ? w : -1;
}

/**
 * Distinct `<lex>.<form>` units with ≥1 correct attempt, all time (attempts + folded aggregates) and in the
 * last 7 days; sentences mastered; words known (distinct lexemes of the produced units).
 */
export function productionStats(state, content, now) {
  const all = new Set();
  const week = new Set();
  for (const [u, agg] of Object.entries(state.unitAggregates ?? {})) if (!isPatternUnit(u) && agg.correct > 0) all.add(u);
  for (const a of state.attempts) {
    if (a.enc || a.c !== 1 || isPatternUnit(a.u)) continue;
    all.add(a.u);
    if (a.t > now - 7 * DAY && a.t <= now) week.add(a.u);
  }
  const words = new Set([...all].map((u) => parseUnitId(u).lex));
  const mastered = masteredSentenceIds(state, content, now).size;
  return { formsAll: all.size, formsWeek: week.size, sentencesMastered: mastered, wordsKnown: words.size };
}

/** Last `WEEKS` rolling weeks, oldest first: forms produced and minutes from `state.history`. */
export function weeklyHistory(state, now) {
  const weeks = Array.from({ length: WEEKS }, (_, i) => ({ label: i === 0 ? "now" : `-${i}w`, forms: 0, minutes: 0 }));
  for (let k = 0; k < WEEKS * 7; k++) {
    const d = state.history[dayKey(now - k * DAY)];
    if (!d) continue;
    const w = weeks[Math.floor(k / 7)];
    w.forms += d.formsProduced ?? 0;
    w.minutes += d.minutes ?? 0;
  }
  return weeks.reverse();
}

/** Cards coming due on each of the next 14 days (today includes everything overdue). */
export function dueForecast(state, now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const counts = Array.from({ length: FORECAST_DAYS }, (_, i) => ({ label: new Date(start.getTime() + i * DAY + DAY / 2).getDate().toString(), value: 0 }));
  for (const c of Object.values(state.cards)) {
    const i = Math.max(0, Math.floor((c.due - start.getTime()) / DAY));
    if (i < FORECAST_DAYS) counts[i].value++;
  }
  return counts;
}

/** Weekly accuracy (0..100, or null with no attempts) of a pattern over the last `WEEKS` weeks, oldest first. */
export function patternTrend(patternId, state, now) {
  const unit = `pat:${patternId}`;
  const n = Array(WEEKS).fill(0);
  const ok = Array(WEEKS).fill(0);
  for (const a of state.attempts) {
    if (a.u !== unit || a.enc) continue;
    const w = weekIndex(a.t, now);
    if (w < 0) continue;
    n[w]++;
    ok[w] += a.c;
  }
  return n.map((c, w) => ({ label: w === 0 ? "now" : `-${w}w`, value: c ? Math.round((ok[w] / c) * 100) : null })).reverse();
}

/** Everything the dashboard shows, as plain data. */
export function dashboardModel(state, content, now) {
  const levels = Object.fromEntries([...content.levels.keys()].map((id) => [id, levelProgress(id, state, content, now)]));
  return {
    levels,
    patternStates: allPatternStates(state, content, now),
    stats: productionStats(state, content, now),
    weekly: weeklyHistory(state, now),
    intake: weeklyIntake(state.history, now),
    forecast: dueForecast(state, now),
    calibration: calibrationSummary(state.calibration, state.settings.targetRetention, now),
  };
}

/** "Target 85 % · last 30 days 93 % (n = 41) · gaps × 1.32", or the target alone before there is any data. */
export function calibrationLine({ target, actual, n, multiplier }) {
  const head = `Target ${Math.round(target * 100)} %`;
  return actual == null ? head : `${head} · last 30 days ${Math.round(actual * 100)} % (n = ${n}) · gaps × ${multiplier.toFixed(2)}`;
}
