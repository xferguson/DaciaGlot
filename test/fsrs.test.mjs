import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_W as W, newCard, review, retrievability, nextInterval, State } from '../app/js/core/fsrs.js';

const T0 = Date.UTC(2026, 0, 1);
const DAY = 86400000;
const MIN = 60000;
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !≈ ${b}`);

// Independent re-derivation of the published FSRS-5 formulas (hand-written constants, no shared code).
//  S0(G) = w[G-1];  D0(G) = w4 - exp(w5*(G-1)) + 1
//  R(t,S) = (1 + 19/81 * t/S)^-0.5;  I(r,S) = S/(19/81) * (r^-2 - 1)
//  D' = D - w6*(G-3); D'' = D' + (10-D')/9 ... then mean-reverted: w7*D0(4) + (1-w7)*D''
const D0 = (g) => W[4] - Math.exp(W[5] * (g - 1)) + 1;
const R = (t, s) => Math.pow(1 + (19 / 81) * (t / s), -0.5);

test('default weights: 19 FSRS-5 values', () => {
  assert.equal(W.length, 19);
  assert.equal(W[0], 0.40255);
  assert.equal(W[18], 0.6621);
});

test('interval for stability S at r=0.9 is ~S days', () => {
  assert.equal(nextInterval(3.173), 3);
  assert.equal(nextInterval(15.69105), 16);
  assert.equal(nextInterval(1e9), 36500);
  assert.equal(nextInterval(0.01), 1);
});

test('New: each grade', () => {
  const c = newCard(T0);
  assert.deepEqual([c.state, c.reps, c.lapses, c.lastReview], [0, 0, 0, null]);
  const again = review(c, 1, T0);
  assert.equal(again.state, State.Learning);
  assert.equal(again.due, T0 + 1 * MIN);
  close(again.stability, 0.40255);
  close(again.difficulty, D0(1) > 10 ? 10 : D0(1));
  const hard = review(c, 2, T0);
  assert.equal(hard.state, State.Learning);
  assert.equal(hard.due, T0 + 1 * MIN);
  close(hard.stability, 1.18385);
  const good = review(c, 3, T0);
  assert.equal(good.state, State.Learning);
  assert.equal(good.due, T0 + 10 * MIN);
  close(good.stability, 3.173);
  close(good.difficulty, D0(3));
  const easy = review(c, 4, T0);
  assert.equal(easy.state, State.Review);
  close(easy.stability, 15.69105);
  assert.equal(easy.due, T0 + 16 * DAY);
  assert.equal(easy.reps, 1);
});

test('review() does not mutate its input', () => {
  const c = newCard(T0);
  const snap = JSON.stringify(c);
  const out = review(c, 3, T0);
  assert.equal(JSON.stringify(c), snap);
  assert.notEqual(out, c);
});

test('Learning: Good steps 1min → 10min → graduate', () => {
  let c = review(newCard(T0), 1, T0); // Again, step 0
  c = review(c, 3, T0 + 1 * MIN);
  assert.equal(c.state, State.Learning);
  assert.equal(c.due, T0 + 1 * MIN + 10 * MIN);
  c = review(c, 3, T0 + 11 * MIN);
  assert.equal(c.state, State.Review);
  assert.ok(c.due >= T0 + 11 * MIN + DAY);
  assert.equal(c.reps, 3);
});

test('Learning: Again resets to step 0, Hard repeats step, Easy graduates', () => {
  const l1 = review(newCard(T0), 3, T0); // step 1
  const again = review(l1, 1, T0 + 10 * MIN);
  assert.equal(again.state, State.Learning);
  assert.equal(again.due, T0 + 10 * MIN + 1 * MIN);
  const hard = review(l1, 2, T0 + 10 * MIN);
  assert.equal(hard.state, State.Learning);
  assert.equal(hard.due, T0 + 20 * MIN);
  const easy = review(l1, 4, T0 + 10 * MIN);
  assert.equal(easy.state, State.Review);
});

test('same-day short-term stability: S * exp(w17 * (G - 3 + w18))', () => {
  const l = review(newCard(T0), 3, T0);
  const c = review(l, 3, T0 + 10 * MIN);
  close(c.stability, 3.173 * Math.exp(W[17] * (0 + W[18])));
  const a = review(l, 1, T0 + 10 * MIN);
  close(a.stability, 3.173 * Math.exp(W[17] * (-2 + W[18])));
});

// Good×4 from New, reviewing exactly on each due date.
test('Good×4 vector', () => {
  let c = newCard(T0);
  let now = T0;
  c = review(c, 3, now); now = c.due; // learning step 2
  const gradAt = now;
  c = review(c, 3, now); // graduates, S = short-term
  const s2 = 3.173 * Math.exp(W[17] * W[18]);
  close(c.stability, s2);
  assert.equal(c.state, State.Review);
  const i1 = Math.round(s2 / (19 / 81) * (Math.pow(0.9, -2) - 1));
  assert.equal(c.due - gradAt, i1 * DAY);
  now = c.due;

  // D after two Good reviews (damped, mean-reverted)
  let d = D0(3);
  const nd = (d) => W[7] * D0(4) + (1 - W[7]) * d; // Good: delta = 0
  d = nd(d); // only the 2nd review updates D; the 1st sets D0
  close(c.difficulty, d);

  const prev = [c.due - now];
  for (let i = 0; i < 4; i++) {
    const elapsed = (c.due - c.lastReview) / DAY;
    const r = R(elapsed, c.stability);
    const expS = c.stability * (1 + Math.exp(W[8]) * (11 - c.difficulty) * Math.pow(c.stability, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1));
    now = c.due;
    c = review(c, 3, now);
    close(c.stability, expS);
    prev.push((c.due - now) / DAY);
  }
  for (let i = 1; i < prev.length; i++) assert.ok(prev[i] > prev[i - 1], `intervals not growing: ${prev}`);
});

test('Review: Hard < Good < Easy stability, Hard/Easy multipliers', () => {
  const base = { due: T0 + 10 * DAY, stability: 10, difficulty: 5, reps: 5, lapses: 0, state: 2, step: 0, lastReview: T0 };
  const now = T0 + 10 * DAY;
  const r = R(10, 10);
  const grow = (g, hard = 1, easy = 1) =>
    10 * (1 + Math.exp(W[8]) * 6 * Math.pow(10, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy);
  close(review(base, 2, now).stability, grow(2, W[15]));
  close(review(base, 3, now).stability, grow(3));
  close(review(base, 4, now).stability, grow(4, 1, W[16]));
  const h = review(base, 2, now), g = review(base, 3, now), e = review(base, 4, now);
  assert.ok(h.stability < g.stability && g.stability < e.stability);
  assert.ok(h.difficulty > g.difficulty && g.difficulty > e.difficulty);
});

test('Review + Again: lapse, Relearning, forget stability', () => {
  const base = { due: T0 + 10 * DAY, stability: 10, difficulty: 5, reps: 5, lapses: 1, state: 2, step: 0, lastReview: T0 };
  const now = T0 + 10 * DAY;
  const c = review(base, 1, now);
  assert.equal(c.lapses, 2);
  assert.equal(c.state, State.Relearning);
  assert.equal(c.due, now + 10 * MIN);
  const expS = W[11] * Math.pow(5, -W[12]) * (Math.pow(11, W[13]) - 1) * Math.exp(W[14] * (1 - R(10, 10)));
  close(c.stability, Math.min(expS, 10));
  assert.ok(c.stability <= 10);
});

test('Relearning: each grade', () => {
  const rl = { due: T0, stability: 2, difficulty: 6, reps: 6, lapses: 1, state: 3, step: 0, lastReview: T0 };
  const now = T0 + 10 * MIN;
  assert.equal(review(rl, 1, now).state, State.Relearning);
  assert.equal(review(rl, 2, now).state, State.Relearning);
  assert.equal(review(rl, 2, now).due, now + 10 * MIN);
  const good = review(rl, 3, now);
  assert.equal(good.state, State.Review);
  assert.equal(good.lapses, 1);
  assert.equal(review(rl, 4, now).state, State.Review);
});

test('Again then Good×3 recovers to Review with growing intervals', () => {
  let c = review(newCard(T0), 1, T0);
  const ivs = [];
  for (let i = 0; i < 3; i++) {
    const now = c.due;
    c = review(c, 3, now);
    if (c.state === State.Review) ivs.push((c.due - now) / DAY);
  }
  assert.equal(c.state, State.Review);
  assert.ok(ivs.length >= 1 && ivs[0] >= 1);
  const next = review(c, 3, c.due);
  assert.ok((next.due - c.due) / DAY > ivs[ivs.length - 1]);
});

test('long overdue review uses low retrievability: bigger gain than on time', () => {
  const base = { due: T0 + 10 * DAY, stability: 10, difficulty: 5, reps: 5, lapses: 0, state: 2, step: 0, lastReview: T0 };
  const onTime = review(base, 3, T0 + 10 * DAY);
  const late = review(base, 3, T0 + 400 * DAY);
  assert.ok(late.stability > onTime.stability);
  assert.ok(retrievability(base, T0 + 400 * DAY) < 0.35);
});

test('retrievability ≈ 0.9 at due date for Review cards', () => {
  let c = review(newCard(T0), 4, T0);
  for (let i = 0; i < 6; i++) {
    close(retrievability(c, c.due), 0.9, 0.01);
    c = review(c, 3, c.due);
  }
  assert.equal(retrievability(newCard(T0), T0), 0);
  close(retrievability(c, c.lastReview), 1);
});

test('Review intervals are whole days, capped at 36500', () => {
  const c = review(newCard(T0), 4, T0);
  assert.equal((c.due - T0) % DAY, 0);
  const huge = { ...c, stability: 1e7, lastReview: T0, due: T0 };
  assert.equal((review(huge, 3, T0 + DAY).due - (T0 + DAY)) / DAY, 36500);
});

test('fuzz: off by default, deterministic with rng, bounded', () => {
  const base = { due: T0, stability: 50, difficulty: 5, reps: 5, lapses: 0, state: 2, step: 0, lastReview: T0 - 50 * DAY };
  const plain = review(base, 3, T0);
  assert.deepEqual(review(base, 3, T0), plain);
  const lo = review(base, 3, T0, { fuzz: true, rng: () => 0 });
  const hi = review(base, 3, T0, { fuzz: true, rng: () => 0.999999 });
  assert.ok(lo.due < hi.due);
  const iv = (plain.due - T0) / DAY;
  assert.ok((lo.due - T0) / DAY >= iv * 0.9 && (hi.due - T0) / DAY <= iv * 1.1);
  assert.throws(() => review(base, 3, T0, { fuzz: true }), TypeError);
});

test('invalid grade throws; difficulty stays in 1..10', () => {
  assert.throws(() => review(newCard(T0), 5, T0), RangeError);
  let c = review(newCard(T0), 1, T0);
  for (let i = 0; i < 30; i++) c = review(c, 1, c.due);
  assert.ok(c.difficulty <= 10 && c.difficulty >= 1);
  let e = review(newCard(T0), 4, T0);
  for (let i = 0; i < 30; i++) e = review(e, 4, e.due);
  assert.ok(e.difficulty >= 1);
});
