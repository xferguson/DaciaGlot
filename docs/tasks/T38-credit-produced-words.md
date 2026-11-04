# T38 · A word you produce correctly inside a sentence counts as its review

| | |
|---|---|
| **Phase** | 3.7 |
| **Depends on** | none |
| **Can run in parallel with** | T37, T41 |
| **Blocks** | T39, T42 |
| **Experiment** | [EXP-12](../EXPERIMENTS.md#exp-12--credit-what-you-already-know--t38t42) |

## Owns (files you may create or change)

- `app/js/core/credit.js` (new, pure): `creditProduced`
- `app/js/core/review.js`: a **one-call hook** in `applyErReview` (non-composite path) and in `applyReview` for `xf`/`sb`. No other edits: T37, T40 and T42 change nearby code.
- `test/credit.test.mjs` (new)
- `app/sw.js` precache + version, `app/js/version.js`
- `docs/PRD.md` new FR-R6; `docs/ARCHITECTURE.md` §8; `docs/EXPERIMENTS.md` EXP-12 status

## Read first (only these)

- `docs/EXPERIMENTS.md` · Check-in 2026-11-04 and EXP-12
- PRD FR-D6, FR-R3, FR-V1
- ARCHITECTURE §4.1, §4.3, §8

## Goal

Today a word you get **wrong** inside a whole-sentence (`er`) card fails its own `fm` card, but a word you type **correctly** gives that card no credit (outside composites). So the same word comes back on its own a day later. Producing it correctly in a full sentence is at least as strong a review.

## Spec

- `creditProduced(state, okUnits, grade, now)` → new state. `okUnits` are the units the learner produced correctly in an `er`, `xf` or `sb` card.
- For each unit whose `fm` card exists and is in Review state:
  - **On time** (time since its last review ≥ 50 % of its current gap): give it a full review through `scheduleCard(card, okGrade, now)`. `okGrade` is the card's grade, and Hard stays Hard.
  - **Early** (< 50 %): leave it. T39 adds partial credit for this case. Leave a `// T39: partial credit here` marker.
- Claimed units and units in a composite that `applyErReview` already reviewed are skipped. No unit gets two reviews from one card.
- Attempts are unchanged: they are already recorded for these units.
- Hooks:
  - `applyErReview` passes `parts.ok` (minus composite units).
  - `applyReview` for `xf`/`sb` passes their target units when grade ≥ 2.
- If T37 has merged first, pass `{ multiplier: state.calibration?.multiplier ?? 1 }` to `scheduleCard`. If not, the second of the two PRs to merge adds it.

## Acceptance criteria

- [ ] Tests:
  - A correct `er` reviews the on-time `fm` cards of its correct parts.
  - Early ones are untouched.
  - A missed part still fails (unchanged).
  - Composites are not double-counted.
  - Claimed units are skipped.
  - `xf`/`sb` credit their target units.
- [ ] The session golden is unchanged (credit applies to reviews, not queue building). If it does change, explain why in the PR.
- [ ] `node --test`, `node scripts/validate-content.mjs` and `node scripts/lint.mjs` pass. STATUS updated.
