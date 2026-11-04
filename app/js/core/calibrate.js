// Calibrating the spacing to the learner's own recall (FR-S13, EXP-11). Pure: `now` is passed in.
import { dayKey, DAY_MS } from "./time.js";

export const DEFAULT_TARGET = 0.85;
export const MIN_LOGGED_GAP_DAYS = 4;
export const LOG_KEEP_DAYS = 60;
export const WINDOW_DAYS = 30;
export const MIN_ENTRIES = 20;
export const NUDGE_STEP = 0.05;
export const MULTIPLIER_RANGE = [0.5, 4];

const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);

export const defaultCalibration = () => ({ multiplier: 1, nudgedOn: null, log: [] });

/**
 * The recall-log entry for a graded review of `prev` at `now`, or null when it doesn't count: the card must be new to
 * the log's rules (reviewed before, due, last gap ≥ 4 d). Otherwise `{ t, gap, ok }` (`ok` = grade ≥ 2, as FSRS counts it).
 */
export function recallEntry(prev, grade, now) {
  if (!prev || prev.lastReview == null || now < prev.due) return null;
  const gap = (prev.due - prev.lastReview) / DAY_MS;
  return gap >= MIN_LOGGED_GAP_DAYS ? { t: now, gap, ok: grade >= 2 } : null;
}

/** `calibration` with `entry` appended and entries older than 60 days dropped. */
export function appendRecall(calibration, entry, now) {
  const cal = calibration ?? defaultCalibration();
  if (!entry) return cal;
  const cutoff = now - LOG_KEEP_DAYS * DAY_MS;
  return { ...cal, log: [...cal.log.filter((e) => e.t >= cutoff), entry] };
}

function recent(calibration, now) {
  const cutoff = now - WINDOW_DAYS * DAY_MS;
  const log = (calibration?.log ?? []).filter((e) => e.t >= cutoff && e.t <= now);
  return { n: log.length, ok: log.filter((e) => e.ok).length };
}

/** At most one adjustment per local day, at most ±5 %, towards the gaps that would give `target` retention. */
export function dailyNudge(calibration, target, now) {
  const cal = calibration ?? defaultCalibration();
  if (cal.nudgedOn === dayKey(now)) return cal;
  const { n, ok } = recent(cal, now);
  if (n < MIN_ENTRIES) return cal;
  const p = clamp((ok + 1) / (n + 2), 0.5, 0.995);
  const k = Math.log(target) / Math.log(p);
  const multiplier = clamp(cal.multiplier * clamp(k, 1 - NUDGE_STEP, 1 + NUDGE_STEP), ...MULTIPLIER_RANGE);
  return { ...cal, multiplier, nudgedOn: dayKey(now) };
}

/** For the dashboard: `actual` is the raw share of recalls in the last 30 days (null with none). */
export function calibrationSummary(calibration, target, now) {
  const { n, ok } = recent(calibration, now);
  return { target, actual: n ? ok / n : null, n, multiplier: calibration?.multiplier ?? 1 };
}
