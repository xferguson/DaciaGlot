// Progress dashboard (PRD FR-P5, P-6): production is the measure. Sections in FR-P5 order.
import { levelProgress, allPatternStates, masteredSentenceIds } from "../../core/mastery.js";
import { dayKey, DAY_MS as DAY } from "../../core/time.js";
import { ring } from "../components/ring.js";
import { barChart, lineChart } from "../components/chart.js";
import { weeklyIntake } from "../../core/pace.js";
import { renderCanDos } from "../components/can-dos.js";

import { WEEKS, FORECAST_DAYS, currentLevelId, productionStats, weeklyHistory, dueForecast, patternTrend, dashboardModel } from "../models/dashboard.js";

// The pure model lives in ui/models/dashboard.js (Q13); re-exported here for one release.
export { WEEKS, FORECAST_DAYS, currentLevelId, productionStats, weeklyHistory, dueForecast, patternTrend, dashboardModel };

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
    el("h3", null, "New items per week"),
    barChart({ data: model.intake.map((w) => ({ label: w.label, value: w.items })), title: "New words and sentences per week", xLabel: "Week", yLabel: "New items" }),
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
