// Scheduling and grading (ARCHITECTURE §8, PRD FR-S1/FR-S2). Pure.
import { newCard, review } from "./fsrs.js";
import { DAY_MS } from "./time.js";

/** PRD FR-S1: Medium (Good) climbs this ladder of gaps, in days, and stays on the top rung. */
export const MEDIUM_LADDER_DAYS = [1, 4, 16, 64, 256];
/** Easy waits this many times Medium's next gap (capped at the top rung). */
export const EASY_FACTOR = 3;

/**
 * Days until the next review for a Medium (3) or Easy (4) answer, given the card's previous scheduled gap
 * in days (0 for a new card): the first rung above it, × `EASY_FACTOR` for Easy. Hard and Again keep FSRS.
 */
export function ladderDays(prevDays, grade) {
  const top = MEDIUM_LADDER_DAYS[MEDIUM_LADDER_DAYS.length - 1];
  const medium = MEDIUM_LADDER_DAYS.find((d) => d > prevDays + 1e-6) ?? top;
  return grade === 4 ? Math.min(top, medium * EASY_FACTOR) : medium;
}

/** PRD FR-S2. `rating` ("hard"|"medium"|"easy") is the learner's self-rating after a clean correct answer. */
export function gradeFromResult({ result, usedHint = false, attemptNo = 1, rating = null, tooEasy = false }) {
  if (result === "wrong") return 1;
  if (usedHint || attemptNo > 1) return 2;
  if (rating === "hard") return 2;
  return rating === "easy" || tooEasy ? 4 : 3;
}

/**
 * One review of a card: FSRS keeps stability/difficulty (mastery reads them); from Good up the gap itself follows the
 * ladder (FR-S1). `lastGrade` records the grade for `isEasy` (FR-V1). `prev` may be undefined (a new card).
 */
export function scheduleCard(prev, grade, now) {
  let card = review(prev ?? newCard(now), grade, now);
  if (grade >= 3) {
    const prevDays = prev?.lastReview != null ? Math.max(0, prev.due - prev.lastReview) / DAY_MS : 0;
    card = { ...card, due: now + ladderDays(prevDays, grade) * DAY_MS };
  }
  return { ...card, lastGrade: grade };
}
