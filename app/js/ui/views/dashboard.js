// Progress dashboard (PRD FR-P5, P-6): production is the measure. Sections in FR-P5 order.
import { levelProgress, allPatternStates, masteredSentenceIds } from "../../core/mastery.js";
import { dayKey } from "../../core/session.js";
import { ring } from "../components/ring.js";
import { barChart, lineChart } from "../components/chart.js";
import { renderCanDos } from "./cando.js";

const DAY = 86400000;
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
  for (const [u, agg] of Object.entries(state.unitAggregates ?? {})) if (!u.startsWith("pat:") && agg.correct > 0) all.add(u);
  for (const a of state.attempts) {
    if (a.enc || a.c !== 1 || a.u.startsWith("pat:")) continue;
    all.add(a.u);
    if (a.t > now - 7 * DAY && a.t <= now) week.add(a.u);
  }
  const words = new Set([...all].map((u) => u.slice(0, u.indexOf("."))));
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
    forecast: dueForecast(state, now),
  };
}

const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
const section = (label, title) => {
  const s = el("section", "card");
  s.setAttribute("aria-label", label);
  s.append(el("h2", null, title));
  return s;
};
const stateLabel = (s) => s.replace("-", " ");

function levelSection(model) {
  const s = section("Level progress", "Levels");
  const row = el("div", "ring-row");
  for (const [id, p] of Object.entries(model.levels)) {
    const b = el("button", "ring-btn");
    b.type = "button";
    b.setAttribute("aria-expanded", "false");
    b.append(ring({ percent: p.percent, label: id }), el("span", "muted", p.complete ? "complete" : `${Math.round(p.percent)}%`));
    const detail = el("ul", "plain breakdown");
    detail.hidden = true;
    for (const [name, r] of [["Patterns producing", p.patterns], ["Can-dos checked", p.canDos], ["Target words produced", p.lexemes]]) {
      detail.append(el("li", null, `${name}: ${r.done} / ${r.total}`));
    }
    b.addEventListener("click", () => {
      detail.hidden = !detail.hidden;
      b.setAttribute("aria-expanded", String(!detail.hidden));
    });
    const wrap = el("div", "ring-item");
    wrap.append(b, detail);
    row.append(wrap);
  }
  s.append(row);
  return s;
}

function patternsSection(ctx, model, now) {
  const { content, state } = ctx;
  const s = section("Patterns", "Patterns");
  const trend = el("div", "trend");
  trend.setAttribute("aria-live", "polite");
  const byStage = new Map();
  for (const p of content.patterns.values()) {
    if (!byStage.has(p.stage)) byStage.set(p.stage, []);
    byStage.get(p.stage).push(p);
  }
  for (const stage of [...byStage.keys()].sort((a, b) => a - b)) {
    s.append(el("h3", null, `Stage ${stage}`));
    const grid = el("div", "pattern-grid");
    for (const p of byStage.get(stage).sort((a, b) => (a.id < b.id ? -1 : 1))) {
      const st = model.patternStates[p.id];
      const chip = el("button", `chip pat-chip st-${st}`, p.name);
      chip.type = "button";
      chip.title = stateLabel(st);
      chip.setAttribute("aria-label", `${p.name}: ${stateLabel(st)}`);
      chip.addEventListener("click", () => {
        trend.replaceChildren(el("h3", null, p.name), el("p", "muted", stateLabel(st)));
        trend.append(lineChart({ data: patternTrend(p.id, state, now), title: `${p.name}: accuracy by week`, xLabel: "Week", yLabel: "Accuracy %" }));
        const ex = el("ul", "plain");
        for (const sid of (content.sentencesByPattern.get(p.id) ?? []).slice(0, 3)) {
          const sen = content.sentences.get(sid);
          const li = el("li");
          const ro = el("span", null, sen.ro);
          ro.lang = "ro";
          li.append(ro, el("span", "muted", ` — ${sen.en}`));
          ex.append(li);
        }
        trend.append(ex);
      });
      grid.append(chip);
    }
    s.append(grid);
  }
  s.append(trend);
  return s;
}

function statsSection(model) {
  const { stats } = model;
  const s = section("Production", "Production");
  const dl = el("dl", "stats");
  for (const [v, k] of [
    [stats.formsAll, "forms produced, all time"],
    [stats.formsWeek, "forms produced this week"],
    [stats.sentencesMastered, "sentences mastered"],
    [stats.wordsKnown, "words known"],
  ]) {
    const d = el("div", "stat");
    d.append(el("dd", null, String(v)), el("dt", "muted", k));
    dl.append(d);
  }
  s.append(dl);
  return s;
}

function chartsSection(model) {
  const s = section("History and forecast", "History");
  const weeks = model.weekly;
  s.append(
    el("h3", null, "Forms produced per week"),
    barChart({ data: weeks.map((w) => ({ label: w.label, value: w.forms })), title: "Forms produced per week", xLabel: "Week", yLabel: "Forms" }),
    el("h3", null, "Minutes per week"),
    barChart({ data: weeks.map((w) => ({ label: w.label, value: w.minutes })), title: "Minutes studied per week", xLabel: "Week", yLabel: "Minutes" }),
    el("h3", null, "Reviews due, next 14 days"),
    barChart({ data: model.forecast, title: "Reviews due in the next 14 days", xLabel: "Day of month", yLabel: "Cards", labelEvery: 2 }),
  );
  return s;
}

export function render(root, ctx) {
  if (!ctx.content) {
    root.textContent = "Content is not loaded.";
    return;
  }
  const now = Date.now();
  const model = dashboardModel(ctx.state, ctx.content, now);
  const back = el("a", "btn secondary", "Home");
  back.href = "#/home";
  const cando = el("div");
  root.replaceChildren(el("h1", null, "Progress"), levelSection(model), patternsSection(ctx, model, now), cando, statsSection(model), chartsSection(model), back);
  const levelId = currentLevelId(model.levels);
  if (levelId) renderCanDos(cando, ctx, levelId, { now });
}
