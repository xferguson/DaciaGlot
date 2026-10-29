# T04 · FSRS-5 scheduler

| | |
|---|---|
| **Phase** | 1 |
| **Depends on** | none |
| **Can run in parallel with** | T01, T02, T03, T05, T06 |

## Owns (files you may create or change)

- `app/js/core/fsrs.js`
- `test/fsrs.test.mjs`

## Read first (only these)

- PRD §4.4 (FR-S1, FR-S2)
- ARCHITECTURE §4.1, §9

## Goal

A dependency-free FSRS-5 implementation matching the published algorithm.

## Spec

- Implement FSRS-5 (19 default weights, request retention 0.9, maximum interval 36500 days, fuzz off by default, optional `fuzz: true` with an injected rng).
- States: New(0) → Learning(1) → Review(2); a lapse goes to Relearning(3). Learning steps are 1 min and 10 min. Graduating interval comes from stability.
- `review()` returns a **new** object (no mutation).
- Pin test vectors: compute expected outputs from the published FSRS-5 formulas (document the derivation in test comments). Cover the sequences: Good×4; Again then Good×3; Hard/Easy branches; a same-day review; a long overdue review.

## Acceptance criteria

- [ ] Deterministic tests for every grade from New, Learning, Review, Relearning.
- [ ] Intervals grow monotonically under repeated Good; Again from Review increments `lapses` and enters Relearning.
- [ ] `retrievability()` is ≈0.9 at the due date for a Review card (±0.01).
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

Parameter optimization; per-user weights.
