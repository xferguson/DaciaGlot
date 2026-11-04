# T37 · Spacing that fits you: every success lengthens, a daily nudge to your target retention

| | |
|---|---|
| **Phase** | 3.7 |
| **Depends on** | none |
| **Can run in parallel with** | T38, T41 |
| **Blocks** | T39, T40 (they use `partialCredit`) |
| **Experiment** | [EXP-11](../EXPERIMENTS.md#exp-11--spacing-that-fits-you--t37) |

## Owns (files you may create or change)

- `app/js/core/schedule.js`: new gap rules, `partialCredit`, constants
- `app/js/core/calibrate.js` (new, pure): `recallLog` entry builder, `dailyNudge`, `calibrationSummary`
- `app/js/core/review.js`: only `applyReview` and the `fm` branch of `applyErReview`, to pass the multiplier and append to the recall log. **Don't touch the rest**: T38, T40 and T42 edit nearby code.
- `app/js/core/fsrs.js`: only if a helper is needed. FSRS keeps tracking stability and difficulty, because mastery reads them.
- `app/js/ui/views/session.js`: FR-S9 re-queue for **wrong only**. This is a one-line change; T40 also edits this file.
- `app/js/ui/views/settings.js`: target-retention slider. `app/js/data/store.js`: `targetRetention` default and `calibration` default.
- `app/js/main.js`: run `dailyNudge` once per local day on load, then save.
- `app/js/ui/models/dashboard.js`, `app/js/ui/views/dashboard.js`: one "target vs actual" line.
- `test/schedule.test.mjs`, `test/calibrate.test.mjs` (new), `test/views-session.test.mjs` (requeue), `test/session-golden.test.mjs` fixture (regenerate)
- `app/sw.js` precache + version, `app/js/version.js`
- `docs/PRD.md` FR-S1, FR-S2, FR-S9, new FR-S13; `docs/ARCHITECTURE.md` §4.1 (CardState `baseGap`), §4 (`state.calibration`), §8; `docs/EXPERIMENTS.md` EXP-11 status

## Read first (only these)

- `docs/EXPERIMENTS.md` · Check-in 2026-11-04 and EXP-11
- PRD FR-S1, FR-S2, FR-S9
- ARCHITECTURE §4.1, §8, §9

## Goal

"My success rate with reviews is way too high for what would be effective." Two rules from the owner: every subsequent success lengthens the gap, whatever the rating; and the spacing adapts to them, aiming at a retention target they set (default 85 %).

## Spec

**Gap rules** (replace the ladder in `ladderDays`; FSRS no longer sets any due date except the in-session wrong re-queue):

| Grade | First gap (card has no `baseGap` yet) | Later gap (`baseGap` × factor) |
|---|---|---|
| Hard (2) | 2 d | × 1.5 |
| Good / Medium (3) | 4 d | × 3 |
| Easy (4) | 10 d | × 6 |

- The card stores **`baseGap`** (days, unscaled). After a success, `baseGap` becomes the new base, and the **actual gap = `baseGap` × `multiplier`**, rounded to whole days.
  - The actual gap is at least `lastActualGap + 1` d, so a success never shortens it, even after the multiplier drops.
  - The actual gap is at most `MAX_GAP_DAYS` = 365.
- **Wrong (1):** the card comes back once in the same session (FR-S9). Then it is due at the next local midnight and `baseGap` resets, so the next success uses the first-gap column.
- **Hard is never re-queued in the session** (FR-S9 change). Only a wrong answer is. The Difficult list fills on a second *wrong* in a session.
- Correct after a hint or on a second try stays Hard (FR-S2 unchanged).
- Export `scheduleCard(prev, grade, now, { multiplier = 1 } = {})`. Existing callers keep working with the default.
- `applyReview` passes `state.calibration?.multiplier ?? 1`, and so does `applyErReview` for its composite `fm` reviews.

**Shared contract for T39 and T40.** Freeze this shape:

- `partialCredit(prev, fraction, now, { multiplier = 1 } = {})` → CardState, for `0 < fraction ≤ 1`.
- It moves the card's due date later by `fraction` of what a Medium success would add: `due' = max(prev.due, now + fraction × (mediumGap − elapsedSinceLastReview))`.
  - `mediumGap` is the actual gap `scheduleCard(prev, 3, now, opts)` would give.
- It never moves `due` earlier. It doesn't change `baseGap`, `reps` or `lastReview`. It records `lastCredit: now`.
- A card in a state other than Review (never reviewed) is returned unchanged.

**Recall log and daily nudge** (`core/calibrate.js`, pure):

- `state.calibration = { multiplier: 1, nudgedOn: null, log: [] }` (defaults via load, no schema bump).
- `applyReview` appends `{ t, gap, ok }` for every graded review of a card that was **due** (`now ≥ due`) with `lastActualGap ≥ 4` d. Here `ok = grade ≥ 2`, as FSRS counts it, and the log is trimmed to the last 60 days. Immediate checks (`enc`), `lr` cards and in-session re-queues are not logged.
- `dailyNudge(calibration, target, now)` runs at most once per local day:
  - Take the log of the last 30 days. If there are fewer than 20 entries, change nothing.
  - Otherwise `p = (ok + 1) / (n + 2)`, clamped to 0.5–0.995.
  - Ideal ratio `k = ln(target) / ln(p)`.
  - `multiplier ← clamp(multiplier × clamp(k, 0.95, 1.05), 0.5, 4)`.
  - Return `{...calibration, multiplier, nudgedOn: dayKey(now)}`.
- `calibrationSummary(calibration, target, now)` → `{ target, actual, n, multiplier }` for the dashboard: "Target 85 % · last 30 days 93 % (n = 41) · gaps × 1.32".

**Settings:** `targetRetention`, a slider from 75 % to 95 % in steps of 1, default **85 %**, with the hint "Lower = longer gaps, fewer reviews."

**Migration:** existing cards have no `baseGap`. On their first review under the new rules, use `lastActualGap` (`due − lastReview`) as the base, so nobody falls back to the first-gap column.

## Acceptance criteria

- [ ] Table-driven tests: first gaps 2 / 4 / 10 d; growth ×1.5 / ×3 / ×6. A run of Hard-only successes strictly lengthens (2 → 3 → 5 → 7 …). The multiplier scales gaps without compounding. A success never shortens, even after a multiplier drop. The 365 d cap holds. Wrong → next local midnight and `baseGap` reset.
- [ ] `partialCredit` tests: never earlier, the fraction scales, a never-reviewed card is unchanged, `lastCredit` is set.
- [ ] `dailyNudge` tests: < 20 entries → no change; 98 % → up at most 5 %; 70 % → down at most 5 %; bounds 0.5 and 4; once per day.
- [ ] Fake-DOM test: Hard is not re-queued in the session and wrong still is (update the Q02 characterization tests that pinned the old behavior, and say so in the PR).
- [ ] Settings slider and dashboard line checked headless (phone width, light and dark).
- [ ] `node --test`, `node scripts/validate-content.mjs` and `node scripts/lint.mjs` pass. STATUS updated.
