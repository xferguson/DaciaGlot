// FSRS-5 scheduler. Pure: `now` (ms epoch) and `rng` are always passed in.
// Reference: https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm

export const DEFAULT_W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
];

export const MAX_INTERVAL = 36500;
export const State = Object.freeze({ New: 0, Learning: 1, Review: 2, Relearning: 3 });
export const Grade = Object.freeze({ Again: 1, Hard: 2, Good: 3, Easy: 4 });

const DAY_MS = 86400000;
const MIN_MS = 60000;
const LEARNING_STEPS = [1, 10]; // minutes
const RELEARNING_STEPS = [10]; // minutes
const DECAY = -0.5;
const FACTOR = 19 / 81;

const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
const clampD = (d) => clamp(d, 1, 10);
const clampS = (s) => Math.max(s, 0.01);

/** @returns {import('./fsrs.js').CardState} */
export function newCard(now) {
  return { due: now, stability: 0, difficulty: 0, reps: 0, lapses: 0, state: State.New, step: 0, lastReview: null };
}

/** Probability of recall after `t` days at stability `s`. */
const forgettingCurve = (t, s) => Math.pow(1 + (FACTOR * t) / s, DECAY);

export function retrievability(card, now) {
  if (card.state === State.New || card.lastReview == null) return 0;
  const t = Math.max(0, (now - card.lastReview) / DAY_MS);
  return forgettingCurve(t, card.stability);
}

/** Whole-day interval for a stability at the given retention. */
export function nextInterval(stability, requestRetention = 0.9) {
  const days = (stability / FACTOR) * (Math.pow(requestRetention, 1 / DECAY) - 1);
  return clamp(Math.round(days), 1, MAX_INTERVAL);
}

const initStability = (w, g) => clampS(w[g - 1]);
const initDifficulty = (w, g) => w[4] - Math.exp(w[5] * (g - 1)) + 1;

function nextDifficulty(w, d, g) {
  const delta = -w[6] * (g - 3);
  const damped = d + (delta * (10 - d)) / 9;
  // mean reversion toward the difficulty of an Easy first review
  return clampD(w[7] * initDifficulty(w, 4) + (1 - w[7]) * damped);
}

function nextRecallStability(w, d, s, r, g) {
  const hard = g === Grade.Hard ? w[15] : 1;
  const easy = g === Grade.Easy ? w[16] : 1;
  return clampS(
    s * (1 + Math.exp(w[8]) * (11 - d) * Math.pow(s, -w[9]) * (Math.exp(w[10] * (1 - r)) - 1) * hard * easy),
  );
}

function nextForgetStability(w, d, s, r) {
  const sf = w[11] * Math.pow(d, -w[12]) * (Math.pow(s + 1, w[13]) - 1) * Math.exp(w[14] * (1 - r));
  return clampS(Math.min(sf, s));
}

const nextShortTermStability = (w, s, g) => clampS(s * Math.exp(w[17] * (g - 3 + w[18])));

function fuzzInterval(days, rng) {
  if (days < 2.5) return days;
  const ranges = [[2.5, 7, 0.15], [7, 20, 0.1], [20, Infinity, 0.05]];
  let delta = 1;
  for (const [a, b, f] of ranges) delta += f * Math.max(Math.min(days, b) - a, 0);
  const lo = Math.max(2, Math.round(days - delta));
  const hi = Math.min(Math.round(days + delta), MAX_INTERVAL);
  return clamp(Math.floor(rng() * (hi - lo + 1) + lo), 1, MAX_INTERVAL);
}

/**
 * Apply a review. Returns a new CardState; `card` is not mutated.
 * @param {number} grade 1 Again · 2 Hard · 3 Good · 4 Easy
 * @param {number} now ms epoch
 * @param {{w?: number[], requestRetention?: number, fuzz?: boolean, rng?: () => number}} [opts]
 */
export function review(card, grade, now, opts = {}) {
  const { w = DEFAULT_W, requestRetention = 0.9, fuzz = false, rng } = opts;
  if (![1, 2, 3, 4].includes(grade)) throw new RangeError(`invalid grade: ${grade}`);
  if (fuzz && typeof rng !== 'function') throw new TypeError('fuzz requires an rng function');

  const next = { ...card, reps: card.reps + 1, lastReview: now, step: card.step ?? 0 };
  const elapsed = card.lastReview == null ? 0 : Math.max(0, (now - card.lastReview) / DAY_MS);
  const sameDay = elapsed < 1;
  let steps = LEARNING_STEPS;

  const graduate = () => {
    let days = nextInterval(next.stability, requestRetention);
    if (fuzz) days = fuzzInterval(days, rng);
    next.state = State.Review;
    next.step = 0;
    next.due = now + days * DAY_MS;
  };
  const schedule = (state, step) => {
    next.state = state;
    next.step = step;
    next.due = now + steps[step] * MIN_MS;
  };

  if (card.state === State.New) {
    next.stability = initStability(w, grade);
    next.difficulty = clampD(initDifficulty(w, grade));
    if (grade === Grade.Easy) graduate();
    else schedule(State.Learning, grade === Grade.Good ? 1 : 0);
    return next;
  }

  const r = retrievability(card, now);

  if (card.state === State.Learning || card.state === State.Relearning) {
    const relearning = card.state === State.Relearning;
    steps = relearning ? RELEARNING_STEPS : LEARNING_STEPS;
    next.difficulty = nextDifficulty(w, card.difficulty, grade);
    next.stability = sameDay
      ? nextShortTermStability(w, card.stability, grade)
      : grade === Grade.Again
        ? nextForgetStability(w, card.difficulty, card.stability, r)
        : nextRecallStability(w, card.difficulty, card.stability, r, grade);
    const step = card.step ?? 0;
    if (grade === Grade.Again) schedule(card.state, 0);
    else if (grade === Grade.Hard) schedule(card.state, Math.min(step, steps.length - 1));
    else if (grade === Grade.Good && step + 1 < steps.length) schedule(card.state, step + 1);
    else graduate();
    return next;
  }

  // Review state
  next.difficulty = nextDifficulty(w, card.difficulty, grade);
  if (grade === Grade.Again) {
    next.lapses = card.lapses + 1;
    next.stability = sameDay
      ? nextShortTermStability(w, card.stability, grade)
      : nextForgetStability(w, card.difficulty, card.stability, r);
    steps = RELEARNING_STEPS;
    schedule(State.Relearning, 0);
    return next;
  }
  next.stability = sameDay
    ? nextShortTermStability(w, card.stability, grade)
    : nextRecallStability(w, card.difficulty, card.stability, r, grade);
  graduate();
  return next;
}
