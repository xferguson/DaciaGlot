// End-of-session summary (PRD FR-P6) and the export reminder rule (FR-X4).
import { renderSummary } from "../components/session-summary.js";
import { EXPORT_REMINDER_DAYS, EXPORT_REMINDER_MIN_STUDY_DAYS, diffPatternStates, formsProduced, exportReminderDue, summarize } from "../models/summary.js";

// The pure model lives in ui/models/summary.js (Q13); re-exported here for one release.
export { EXPORT_REMINDER_DAYS, EXPORT_REMINDER_MIN_STUDY_DAYS, diffPatternStates, formsProduced, exportReminderDue, summarize, renderSummary };

export function render(root, ctx) {
  root.innerHTML = `<h1>Summary</h1><p class="muted">Finish a session to see its summary.</p><a class="btn secondary block" href="#/home">Home</a>`;
}
