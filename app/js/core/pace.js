// Intake pace (T36, FR-V5): pure helpers. Nothing here leaves the device.
import { dayKey, DAY_MS as DAY } from "./time.js";
import { bumpDay } from "./history.js";

export const BATCH_MIN = 5;
export const BATCH_MAX = 40;
export const PACE_WEEKS = 8;
export const GROW_ACCURACY = 0.85;
export const SHRINK_ACCURACY = 0.6;

/**
 * What one session took in. `exposures` is `state.seenSentences` (sentenceId → first-seen ts); a sentence first
 * seen in [startedAt, endedAt] is new. New forms are the distinct form units given an immediate check
 * (`enc` attempts) in the window. `perTen` = new items (forms + sentences) per 10 minutes.
 * @returns {{newForms:number, newSentences:number, newPatterns:string[], minutes:number, perTen:number, reviewShare:number}}
 */
export function sessionPace(attempts, exposures, startedAt, endedAt, content) {
  const inWin = (t) => t >= startedAt && t <= endedAt;
  const forms = new Set();
  let reviews = 0;
  let counted = 0;
  for (const a of attempts ?? []) {
    if (!inWin(a.t)) continue;
    if (a.enc) { if (!a.u.startsWith("pat:")) forms.add(a.u); continue; }
    counted++;
    reviews++;
  }
  const sentences = Object.entries(exposures ?? {}).filter(([, t]) => inWin(t)).map(([id]) => id);
  const patterns = new Set();
  for (const id of sentences) for (const p of content?.sentences?.get(id)?.patterns ?? []) patterns.add(p);
  const minutes = Math.max(0, (endedAt - startedAt) / 60000);
  const items = forms.size + sentences.length;
  const total = counted + forms.size;
  return {
    newForms: forms.size,
    newSentences: sentences.length,
    newPatterns: [...patterns],
    minutes,
    perTen: minutes > 0 ? (items * 10) / minutes : 0,
    reviewShare: total ? reviews / total : 0,
  };
}

/** New items per rolling week (`history[day].newItems`), oldest first, last `PACE_WEEKS` weeks. */
export function weeklyIntake(history, now, weeks = PACE_WEEKS) {
  const out = Array.from({ length: weeks }, (_, i) => ({ label: i === 0 ? "now" : `-${i}w`, items: 0 }));
  for (let k = 0; k < weeks * 7; k++) out[Math.floor(k / 7)].items += history?.[dayKey(now - k * DAY)]?.newItems ?? 0;
  return out.reverse();
}

/**
 * Next Learn batch size. Under target and `checkAccuracy` (0..1) ≥ 85 % → ×1.25; accuracy < 60 % → ×0.75;
 * otherwise unchanged. Rounded, bounded by [min, max]. No checks (`checkAccuracy` null) → unchanged.
 */
export function nextBatchSize(current, perTen, target, checkAccuracy, min = BATCH_MIN, max = BATCH_MAX) {
  let n = current;
  if (checkAccuracy != null) {
    if (checkAccuracy < SHRINK_ACCURACY) n = current * 0.75;
    else if (perTen < target && checkAccuracy >= GROW_ACCURACY) n = current * 1.25;
  }
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Learn batch size in effect: the adapted size when `adaptiveBatch` is on, else the setting. */
export function learnBatch(state) {
  const base = state.settings.newItemsPerLearn;
  const adapted = state.pace?.batch;
  return state.settings.adaptiveBatch !== false && adapted ? Math.min(BATCH_MAX, Math.max(BATCH_MIN, adapted)) : base;
}

/** Accuracy (0..1) of the immediate checks in the window, or null when there were none. */
export function checkAccuracy(attempts, startedAt, endedAt) {
  const e = (attempts ?? []).filter((a) => a.enc && a.t >= startedAt && a.t <= endedAt);
  return e.length ? e.reduce((s, a) => s + a.c, 0) / e.length : null;
}

/** State after a finished session: today's `newItems`, and (Learn only) the next batch size + last 10 batch records. Pure. */
export function recordSession(state, { pace, accuracy, learn, now }) {
  const out = { ...state, history: bumpDay(state.history, now, (d) => { d.newItems += pace.newForms + pace.newSentences; }) };
  if (learn && pace.newForms + pace.newSentences > 0) {
    const cur = learnBatch(state);
    const target = state.settings.paceTarget;
    const next = state.settings.adaptiveBatch !== false ? nextBatchSize(cur, pace.perTen, target, accuracy) : cur;
    const prev = state.pace?.history ?? [];
    out.pace = { batch: next, history: [...prev, { t: now, size: cur, perTen: Math.round(pace.perTen * 10) / 10 }].slice(-10) };
  }
  return out;
}
