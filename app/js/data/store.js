import { CURRENT_SCHEMA_VERSION, migrate } from './migrations.js';

export const STATE_KEY = 'dg:v1:state';
const SAVE_DEBOUNCE_MS = 500;

export class ImportError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ImportError';
  }
}

/** @param {number} now ms epoch */
export function defaultState(now) {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    contentVersion: '',
    createdAt: now,
    settings: {
      newPerSession: 8,
      ttsRate: 0.9,
      voiceURI: null,
      autoplay: true,
      registers: ['colloquial', 'neutral'],
      lastExportAt: null,
      ttsBannerDismissed: false,
    },
    cards: {},
    seenSentences: {},
    lexemeSentences: {},
    attempts: [],
    unitAggregates: {},
    flags: [],
    history: {},
    canDoChecked: {},
    lastCompactionAt: null,
  };
}

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Fill any field missing from `s` with its default (one level deep for settings). */
function withDefaults(s, now) {
  const d = defaultState(now);
  const out = { ...d, ...s, settings: { ...d.settings, ...(isObject(s.settings) ? s.settings : {}) } };
  for (const k of ['cards', 'seenSentences', 'lexemeSentences', 'unitAggregates', 'history', 'canDoChecked']) {
    if (!isObject(out[k])) out[k] = d[k];
  }
  for (const k of ['attempts', 'flags']) {
    if (!Array.isArray(out[k])) out[k] = d[k];
  }
  return out;
}

/** State as persisted: without transient fields such as `_recovered`. */
function persistable(state) {
  const { _recovered, ...rest } = state;
  return rest;
}

// ---- storage + save scheduling ---------------------------------------------

const errorHandlers = [];
let pending = null; // latest state awaiting a debounced write
let timer = null;
let visibilityHooked = false;

/** Register a callback for storage errors (e.g. quota). Called with the Error. */
export function onError(fn) {
  errorHandlers.push(fn);
  return () => {
    const i = errorHandlers.indexOf(fn);
    if (i >= 0) errorHandlers.splice(i, 1);
  };
}

function reportError(err) {
  for (const fn of errorHandlers) {
    try { fn(err); } catch { /* a bad handler must not break saving */ }
  }
}

function write(state) {
  try {
    globalThis.localStorage.setItem(STATE_KEY, JSON.stringify(persistable(state)));
    return true;
  } catch (err) {
    reportError(err);
    return false;
  }
}

export function save(state) {
  pending = state;
  hookVisibility();
  if (timer !== null) clearTimeout(timer);
  timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
  timer?.unref?.();
}

export function flush() {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (pending) {
    const s = pending;
    pending = null;
    write(s);
  }
}

function hookVisibility() {
  if (visibilityHooked) return;
  const doc = globalThis.document;
  if (!doc?.addEventListener) return;
  visibilityHooked = true;
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') flush();
  });
}

// ---- load ------------------------------------------------------------------

function backupCorrupt(raw, now) {
  try {
    globalThis.localStorage.setItem(`${STATE_KEY}.corrupt-${now}`, raw);
  } catch (err) {
    reportError(err);
  }
}

/** Load state, migrating it. Never throws: corrupt or unusable data is backed up and replaced. */
export function load() {
  const now = Date.now();
  let raw = null;
  try {
    raw = globalThis.localStorage.getItem(STATE_KEY);
  } catch (err) {
    reportError(err);
  }
  if (raw === null) return defaultState(now);

  let state = null;
  try {
    const parsed = JSON.parse(raw);
    if (
      isObject(parsed) &&
      Number.isInteger(parsed.schemaVersion) &&
      parsed.schemaVersion >= 1 &&
      parsed.schemaVersion <= CURRENT_SCHEMA_VERSION
    ) {
      state = withDefaults(migrate(parsed), now);
    }
  } catch { /* fall through to recovery */ }

  if (state) return state;
  backupCorrupt(raw, now);
  const fresh = defaultState(now);
  Object.defineProperty(fresh, '_recovered', { value: true, enumerable: false, writable: true, configurable: true });
  return fresh;
}

// ---- export / import ---------------------------------------------------------

export function exportState(state) {
  return new Blob([JSON.stringify(persistable(state), null, 2)], { type: 'application/json' });
}

/**
 * @param {string|object} json  backup text (or an already parsed object)
 * @param {"merge"|"replace"} mode
 * @param {object} current      the current in-memory state
 * @returns {object} new state (not saved)
 * @throws {ImportError}
 */
export function importState(json, mode, current) {
  if (mode !== 'merge' && mode !== 'replace') throw new ImportError(`Unknown import mode: ${mode}`);
  let incoming = json;
  if (typeof json === 'string') {
    try {
      incoming = JSON.parse(json);
    } catch {
      throw new ImportError('This file is not valid JSON.');
    }
  }
  if (!isObject(incoming)) throw new ImportError('This file is not a DaciaGlot backup.');
  const v = incoming.schemaVersion;
  if (!Number.isInteger(v) || v < 1) throw new ImportError('This file is not a DaciaGlot backup (no schemaVersion).');
  if (v > CURRENT_SCHEMA_VERSION) {
    throw new ImportError(
      `This backup was made by a newer version of the app (schema ${v}; this app supports up to ${CURRENT_SCHEMA_VERSION}). Update the app and try again.`,
    );
  }
  for (const k of ['cards', 'seenSentences', 'lexemeSentences', 'unitAggregates', 'history', 'canDoChecked', 'settings']) {
    if (k in incoming && !isObject(incoming[k])) throw new ImportError(`Backup field "${k}" has the wrong shape.`);
  }
  for (const k of ['attempts', 'flags']) {
    if (k in incoming && !Array.isArray(incoming[k])) throw new ImportError(`Backup field "${k}" has the wrong shape.`);
  }

  let migrated;
  try {
    migrated = withDefaults(migrate(incoming), Date.now());
  } catch (err) {
    throw new ImportError(`Could not migrate this backup: ${err.message}`);
  }
  migrated = persistable(migrated);
  return mode === 'replace' ? migrated : mergeStates(current, migrated);
}

// ---- merge -----------------------------------------------------------------

function mergeStates(cur, inc) {
  const out = structuredClone(cur);

  // cards: keep the one with the later lastReview (ties keep the current device's)
  for (const [id, card] of Object.entries(inc.cards)) {
    const mine = out.cards[id];
    if (!mine || (card.lastReview ?? -Infinity) > (mine.lastReview ?? -Infinity)) {
      out.cards[id] = structuredClone(card);
    }
  }

  // attempts: union deduplicated by card+t+u
  const key = (a) => `${a.card}\u0000${a.t}\u0000${a.u}`;
  const seen = new Set(out.attempts.map(key));
  for (const a of inc.attempts) {
    if (!seen.has(key(a))) {
      seen.add(key(a));
      out.attempts.push(structuredClone(a));
    }
  }
  out.attempts.sort((a, b) => a.t - b.t);

  // seenSentences: min timestamp
  for (const [id, ts] of Object.entries(inc.seenSentences)) {
    out.seenSentences[id] = id in out.seenSentences ? Math.min(out.seenSentences[id], ts) : ts;
  }

  // history: per-day max of each field
  for (const [day, st] of Object.entries(inc.history)) {
    const mine = out.history[day];
    if (!mine) {
      out.history[day] = { ...st };
      continue;
    }
    for (const [f, n] of Object.entries(st)) mine[f] = Math.max(mine[f] ?? 0, n);
  }

  // flags: union
  const flagKey = (f) => `${f.sentenceId}\u0000${f.ts}\u0000${f.note}`;
  const flagSeen = new Set(out.flags.map(flagKey));
  for (const f of inc.flags) {
    if (!flagSeen.has(flagKey(f))) {
      flagSeen.add(flagKey(f));
      out.flags.push({ ...f });
    }
  }

  // canDoChecked: union (earliest timestamp wins)
  for (const [id, ts] of Object.entries(inc.canDoChecked)) {
    out.canDoChecked[id] = id in out.canDoChecked ? Math.min(out.canDoChecked[id], ts) : ts;
  }

  // lexemeSentences: union of sentence ids
  for (const [lx, ids] of Object.entries(inc.lexemeSentences)) {
    out.lexemeSentences[lx] = [...new Set([...(out.lexemeSentences[lx] ?? []), ...ids])];
  }

  // unitAggregates: aggregates are folded counts, so summing could double count; keep the larger
  for (const [u, agg] of Object.entries(inc.unitAggregates)) {
    const mine = out.unitAggregates[u];
    if (!mine || agg.n > mine.n) out.unitAggregates[u] = structuredClone(agg);
  }

  out.createdAt = Math.min(out.createdAt, inc.createdAt);
  out.lastCompactionAt =
    out.lastCompactionAt === null || inc.lastCompactionAt === null
      ? out.lastCompactionAt ?? inc.lastCompactionAt
      : Math.max(out.lastCompactionAt, inc.lastCompactionAt);
  // settings and contentVersion: current device's values
  return out;
}
