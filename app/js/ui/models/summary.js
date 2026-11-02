// End-of-session summary (PRD FR-P6) and the export reminder rule (FR-X4).
// The helpers are pure so they can be tested without a DOM.
import { allPatternStates } from "../../core/mastery.js";
import { DAY_MS as DAY } from "../../core/time.js";

export const EXPORT_REMINDER_DAYS = 14;
export const EXPORT_REMINDER_MIN_STUDY_DAYS = 3;

/** Patterns whose state differs between two `allPatternStates` maps → `{id, from, to}[]`. */
export function diffPatternStates(before, after) {
  return Object.keys(after)
    .filter((id) => (before[id] ?? "not-started") !== after[id])
    .map((id) => ({ id, from: before[id] ?? "not-started", to: after[id] }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** Distinct units answered correctly at or after `since` (ms epoch). */
export function formsProduced(attempts, since) {
  return new Set(attempts.filter((a) => a.c === 1 && !a.enc && a.t >= since).map((a) => a.u)).size;
}

/**
 * Banner rule: `lastExportAt` null → after the 3rd day of study; otherwise once it is older than 14 days.
 * (Sessions aren't recorded individually, so days with ≥1 card stand in for sessions.)
 */
export function exportReminderDue(state, now) {
  const last = state.settings.lastExportAt;
  if (last == null) {
    const days = Object.values(state.history).filter((d) => d.cards > 0).length;
    return days >= EXPORT_REMINDER_MIN_STUDY_DAYS;
  }
  return now - last > EXPORT_REMINDER_DAYS * DAY;
}

export function summarize({ before, state, content, stats, startedAt, now, pace = null, target = 15 }) {
  return {
    pace,
    target,
    cards: stats.cards,
    correct: stats.correct,
    newSentences: stats.newSentences,
    difficult: stats.difficult ?? 0,
    forms: formsProduced(state.attempts, startedAt),
    changes: diffPatternStates(before, allPatternStates(state, content, now)),
  };
}
