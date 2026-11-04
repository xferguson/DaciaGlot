// Scheduling and grading (ARCHITECTURE §8, PRD FR-S1/FR-S2). Pure.
import { newCard, review, State } from "./fsrs.js";
import { DAY_MS, startOfDayPlus } from "./time.js";

/** PRD FR-S1: the first gap (days) after a first success, by grade (Hard 2, Good 3, Easy 4). */
export const FIRST_GAP_DAYS = { 2: 2, 3: 4, 4: 10 };
/** Growth of the unscaled `baseGap` on each later success, by grade. */
export const GROWTH = { 2: 1.5, 3: 3, 4: 6 };
export const MAX_GAP_DAYS = 365;

/** PRD FR-S2. `rating` ("hard"|"medium"|"easy") is the learner's self-rating after a clean correct answer. */
export function gradeFromResult({ result, usedHint = false, attemptNo = 1, rating = null, tooEasy = false }) {
  if (result === "wrong") return 1;
  if (usedHint || attemptNo > 1) return 2;
  if (rating === "hard") return 2;
  return rating === "easy" || tooEasy ? 4 : 3;
}

const gapDays = (card) => (card?.lastReview != null ? Math.max(0, card.due - card.lastReview) / DAY_MS : 0);

/**
 * One review of a card (FR-S1). FSRS keeps stability/difficulty (mastery reads them) but no longer sets the due date:
 * a success lengthens the gap whatever the grade (`baseGap` × growth, × `multiplier`, never shorter than last time,
 * at most `MAX_GAP_DAYS`); wrong is due at the next local midnight and resets `baseGap`. `lastGrade` records the grade
 * for `isEasy` (FR-V1). `prev` may be undefined (a new card).
 */
export function scheduleCard(prev, grade, now, { multiplier = 1 } = {}) {
  const card = review(prev ?? newCard(now), grade, now);
  if (grade === 1) return { ...card, due: startOfDayPlus(now, 1), baseGap: 0, lastGrade: grade };
  const last = gapDays(prev);
  // A card from before `baseGap` joins at its last gap; a gap under a day is a learning step, so it starts afresh.
  const base = prev?.baseGap ?? (last >= 1 ? last : 0);
  const baseGap = Math.min(MAX_GAP_DAYS, base > 0 ? Math.max(FIRST_GAP_DAYS[grade], base * GROWTH[grade]) : FIRST_GAP_DAYS[grade]);
  const days = Math.min(MAX_GAP_DAYS, Math.max(Math.round(baseGap * multiplier), Math.round(last) + 1));
  return { ...card, state: State.Review, step: 0, due: now + days * DAY_MS, baseGap, lastGrade: grade };
}

/** FR-S14 (T40): share of a Medium success a correct answer on a primed card (its word was just on screen) is worth. */
export const PRIMED_CREDIT = 0.25;

/**
 * FR-S13 (shared with T39/T40): credit for meeting a card in context without testing it. Moves `due` later by
 * `fraction` (0..1] of what a Medium success would add, never earlier; `baseGap`, `reps` and `lastReview` are kept and
 * `lastCredit` is set. A card never reviewed is returned unchanged.
 */
export function partialCredit(prev, fraction, now, opts = {}) {
  if (!prev || prev.state !== State.Review || prev.lastReview == null) return prev;
  const mediumGap = scheduleCard(prev, 3, now, opts).due - now;
  const due = Math.max(prev.due, now + fraction * (mediumGap - (now - prev.lastReview)));
  return { ...prev, due, lastCredit: now };
}
