import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { installLocalStorage } from './helpers/local-storage-shim.mjs';
import {
  STATE_KEY, defaultState, load, save, flush, exportState, importState, onError, ImportError,
} from '../app/js/data/store.js';
import { CURRENT_SCHEMA_VERSION, migrations, migrate } from '../app/js/data/migrations.js';

let ls;
beforeEach(() => {
  ls = installLocalStorage();
});

const NOW = Date.UTC(2026, 0, 1);
const DAY = 86400000;
const card = (lastReview, extra = {}) => ({
  due: 0, stability: 1, difficulty: 5, reps: 1, lapses: 0, state: 2, lastReview, ...extra,
});

test('defaultState has every documented field', () => {
  const s = defaultState(NOW);
  assert.deepEqual(Object.keys(s).sort(), [
    'activeSession', 'attempts', 'canDoChecked', 'cards', 'contentVersion', 'createdAt', 'flags', 'history',
    'lastCompactionAt', 'lexemeSentences', 'schemaVersion', 'seenSentences', 'settings', 'unitAggregates',
  ]);
  assert.equal(s.schemaVersion, 1);
  assert.equal(s.createdAt, NOW);
  assert.deepEqual(s.settings, {
    newPerSession: 8, ttsRate: 0.9, voiceURI: null, autoplay: true,
    registers: ['colloquial', 'neutral'], lastExportAt: null, ttsBannerDismissed: false,
  });
});

test('load: empty storage gives defaults, not flagged as recovered', () => {
  const s = load();
  assert.equal(s._recovered, undefined);
  assert.equal(s.schemaVersion, 1);
  assert.equal(ls.length, 0);
});

test('save is debounced; flush writes immediately', async () => {
  const s = defaultState(NOW);
  save(s);
  assert.equal(ls.getItem(STATE_KEY), null);
  flush();
  assert.deepEqual(JSON.parse(ls.getItem(STATE_KEY)), s);
  s.settings.newPerSession = 12;
  save(s);
  await new Promise((r) => setTimeout(r, 650));
  assert.equal(JSON.parse(ls.getItem(STATE_KEY)).settings.newPerSession, 12);
});

test('save → load round-trip; _recovered is never persisted', () => {
  const s = defaultState(NOW);
  s.cards['a|b'] = card(NOW);
  Object.defineProperty(s, '_recovered', { value: true, enumerable: true, writable: true });
  save(s);
  flush();
  assert.ok(!('_recovered' in JSON.parse(ls.getItem(STATE_KEY))));
  assert.deepEqual(load().cards, s.cards);
});

test('corrupt JSON: raw string backed up, fresh state, _recovered set', () => {
  ls.setItem(STATE_KEY, '{"schemaVersion":1,"cards":');
  const s = load();
  assert.equal(s._recovered, true);
  assert.deepEqual(s.cards, {});
  const keys = Array.from({ length: ls.length }, (_, i) => ls.key(i));
  const bk = keys.find((k) => k.startsWith(`${STATE_KEY}.corrupt-`));
  assert.ok(bk, `backup key missing among ${keys}`);
  assert.equal(ls.getItem(bk), '{"schemaVersion":1,"cards":');
  assert.ok(!('_recovered' in JSON.parse(JSON.stringify(s))));
});

test('missing schemaVersion or newer version: backed up and reset', () => {
  for (const raw of ['{"cards":{}}', '[]', '"x"', JSON.stringify({ schemaVersion: 99 })]) {
    installLocalStorage();
    globalThis.localStorage.setItem(STATE_KEY, raw);
    const s = load();
    assert.equal(s._recovered, true, raw);
    const keys = Array.from({ length: globalThis.localStorage.length }, (_, i) => globalThis.localStorage.key(i));
    assert.ok(keys.some((k) => k.startsWith(`${STATE_KEY}.corrupt-`)), raw);
  }
});

test('load fills fields missing from an older partial state', () => {
  ls.setItem(STATE_KEY, JSON.stringify({ schemaVersion: 1, createdAt: 5, settings: { autoplay: false } }));
  const s = load();
  assert.equal(s.createdAt, 5);
  assert.equal(s.settings.autoplay, false);
  assert.equal(s.settings.newPerSession, 8);
  assert.deepEqual(s.attempts, []);
});

test('quota error on save invokes onError callback and does not throw', () => {
  installLocalStorage({ quota: 50 });
  const errs = [];
  const off = onError((e) => errs.push(e));
  save(defaultState(NOW));
  assert.doesNotThrow(flush);
  off();
  assert.equal(errs.length, 1);
  assert.equal(errs[0].name, 'QuotaExceededError');
});

test('migrate runs pending migrations in order', () => {
  assert.deepEqual(migrate({ schemaVersion: CURRENT_SCHEMA_VERSION, x: 1 }), { schemaVersion: CURRENT_SCHEMA_VERSION, x: 1 });
  assert.throws(() => migrate({ schemaVersion: 0 }), /No migration/);
  assert.deepEqual(Object.keys(migrations), []);
});

test('export → import(replace) round-trips to a deep-equal state', async () => {
  const s = defaultState(NOW);
  s.cards['x|1'] = card(NOW, { reps: 4 });
  s.seenSentences.s1 = NOW;
  s.lexemeSentences.lx = ['s1', 's2'];
  s.attempts.push({ u: 'lx.base', lx: 'lx', c: 1, t: NOW, card: 'x|1' });
  s.unitAggregates['pat:p'] = { n: 3, correct: 2, lexemes: ['lx'], lastCorrectAt: NOW };
  s.flags.push({ sentenceId: 's1', note: 'typo', ts: NOW });
  s.history['2026-01-01'] = { minutes: 5, cards: 20, newSentences: 3, formsProduced: 2 };
  s.canDoChecked.c1 = NOW;
  s.lastCompactionAt = NOW;
  s.settings.voiceURI = 'ro-RO-x';
  const text = await exportState(s).text();
  assert.deepEqual(importState(text, 'replace', defaultState(NOW + 1)), s);
});

test('import rejects bad input with ImportError', () => {
  const cur = defaultState(NOW);
  const bad = (x, re) => assert.throws(() => importState(x, 'merge', cur), (e) => e instanceof ImportError && re.test(e.message));
  bad('not json', /valid JSON/);
  bad('[]', /not a DaciaGlot backup/);
  bad('{}', /schemaVersion/);
  bad(JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }), /newer version/);
  bad(JSON.stringify({ schemaVersion: 1, cards: [] }), /"cards"/);
  bad(JSON.stringify({ schemaVersion: 1, attempts: {} }), /"attempts"/);
  assert.throws(() => importState('{}', 'bogus', cur), ImportError);
});

test('merge: cards keep the later lastReview', () => {
  const cur = defaultState(NOW);
  const inc = defaultState(NOW);
  cur.cards.a = card(100, { reps: 1 });
  inc.cards.a = card(200, { reps: 2 });
  cur.cards.b = card(300, { reps: 1 });
  inc.cards.b = card(250, { reps: 2 });
  inc.cards.c = card(10);
  cur.cards.d = card(null);
  inc.cards.d = card(5, { reps: 7 });
  const m = importState(JSON.stringify(inc), 'merge', cur);
  assert.equal(m.cards.a.reps, 2);
  assert.equal(m.cards.b.reps, 1);
  assert.ok(m.cards.c);
  assert.equal(m.cards.d.reps, 7);
});

test('merge: attempts are a union deduplicated by card+t+u', () => {
  const cur = defaultState(NOW);
  const inc = defaultState(NOW);
  const a1 = { u: 'x.base', lx: 'x', c: 1, t: 10, card: 'k1' };
  const a2 = { u: 'x.base', lx: 'x', c: 0, t: 20, card: 'k1' };
  const a3 = { u: 'y.base', lx: 'y', c: 1, t: 10, card: 'k1' }; // same card+t, different unit
  cur.attempts.push(a1);
  inc.attempts.push({ ...a1 }, a2, a3);
  const m = importState(inc, 'merge', cur);
  assert.equal(m.attempts.length, 3);
});

test('merge: seenSentences min, history per-day max, flags/canDo unions, settings kept', () => {
  const cur = defaultState(NOW);
  const inc = defaultState(NOW - DAY);
  cur.seenSentences = { s1: 50, s2: 10 };
  inc.seenSentences = { s1: 20, s3: 5 };
  cur.history['2026-01-01'] = { minutes: 5, cards: 10, newSentences: 1, formsProduced: 9 };
  inc.history['2026-01-01'] = { minutes: 3, cards: 30, newSentences: 4, formsProduced: 2 };
  inc.history['2025-12-31'] = { minutes: 1, cards: 2, newSentences: 0, formsProduced: 0 };
  cur.flags.push({ sentenceId: 's1', note: 'a', ts: 1 });
  inc.flags.push({ sentenceId: 's1', note: 'a', ts: 1 }, { sentenceId: 's2', note: 'b', ts: 2 });
  cur.canDoChecked = { c1: 100 };
  inc.canDoChecked = { c1: 50, c2: 60 };
  cur.lexemeSentences = { lx: ['s1'] };
  inc.lexemeSentences = { lx: ['s1', 's2'], ly: ['s3'] };
  cur.settings.newPerSession = 3;
  inc.settings.newPerSession = 20;
  cur.contentVersion = 'cur';
  inc.contentVersion = 'inc';
  const m = importState(JSON.stringify(inc), 'merge', cur);
  assert.deepEqual(m.seenSentences, { s1: 20, s2: 10, s3: 5 });
  assert.deepEqual(m.history['2026-01-01'], { minutes: 5, cards: 30, newSentences: 4, formsProduced: 9 });
  assert.ok(m.history['2025-12-31']);
  assert.equal(m.flags.length, 2);
  assert.deepEqual(m.canDoChecked, { c1: 50, c2: 60 });
  assert.deepEqual(m.lexemeSentences, { lx: ['s1', 's2'], ly: ['s3'] });
  assert.equal(m.settings.newPerSession, 3);
  assert.equal(m.contentVersion, 'cur');
  assert.equal(m.createdAt, NOW - DAY);
});

test('merge does not mutate the current state', () => {
  const cur = defaultState(NOW);
  cur.cards.a = card(1);
  const snap = structuredClone(cur);
  const inc = defaultState(NOW);
  inc.cards.a = card(2);
  importState(inc, 'merge', cur);
  assert.deepEqual(cur, snap);
});

test('NFR-2: 600 sentences × 5 cards + 90 days × 150 attempts serializes < 2 MB', () => {
  const s = defaultState(NOW);
  const cardIds = [];
  for (let i = 0; i < 600; i++) {
    const sid = `s${String(i).padStart(4, '0')}-situation-name`;
    s.seenSentences[sid] = NOW - i * 1000;
    for (let k = 0; k < 5; k++) {
      const id = `${sid}|${['listen', 'cloze', 'recall', 'build', 'transform'][k]}`;
      cardIds.push(id);
      s.cards[id] = {
        due: NOW + i * 3600000, stability: 12.3456789012, difficulty: 5.4321098765,
        reps: 7, lapses: 1, state: 2, lastReview: NOW - i * 7200000,
      };
    }
  }
  for (let d = 0; d < 90; d++) {
    const day = new Date(NOW - d * DAY).toISOString().slice(0, 10);
    s.history[day] = { minutes: 14, cards: 150, newSentences: 8, formsProduced: 40 };
    for (let a = 0; a < 150; a++) {
      const id = cardIds[(d * 150 + a) % cardIds.length];
      s.attempts.push({ u: `lexeme${a % 300}.formkey${a % 7}`, lx: `lexeme${a % 300}`, c: a % 3 ? 1 : 0, t: NOW - d * DAY + a * 1000, card: id });
    }
  }
  const size = JSON.stringify(s).length;
  assert.ok(size < 2 * 1024 * 1024, `serialized size ${size} bytes`);
  const quotaLs = installLocalStorage({ quota: 2 * 1024 * 1024 });
  save(s);
  flush();
  assert.ok(quotaLs.getItem(STATE_KEY));
});
