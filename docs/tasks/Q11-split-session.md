# Q11 · Split `core/session.js` and `composeSession` into named steps

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | Q09 |
| **Can run in parallel with** | none (core lane is serial) |

## Owns (files you may create or change)

- `app/js/core/session.js` (becomes a re-export barrel)
- `app/js/core/{queue,schedule,review}.js` (new)
- `test/{queue,schedule,review}.test.mjs` (new; move cases from `session.test.mjs`)
- `docs/ARCHITECTURE.md` §1, §8
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- ARCHITECTURE §8 Sessions, §8.1
- PRD FR-S1 to FR-S10, FR-R2, FR-R5, FR-V1

## Goal

`session.js` is ~670 lines with five jobs: queue building, scheduling, grading, state transitions and history. `composeSession` alone is ~110 lines mixing mode switching, the Mix budget trim, the cold-start top-up, paradigm grouping, interleaving and a one-line estimate.

## Spec

- `queue.js` (`buildSession`, `composeSession` steps, `spaceOut`, `placeChecks`, `burySiblings`, `onePerFamily`, `composeReviews`), `schedule.js` (`ladderDays`, `scheduleCard`, `gradeFromResult`), `review.js` (`applyReview`, `applyErReview`, `applyCheck`, `applyParadigm`, `erMisses`, claims, `keepStarted`, `markDifficult`).
- `composeSession` becomes a pipeline of named, separately tested steps: `selectDue`, `trimToBudget`, `pickNew`, `groupNew`, `interleave`, `estimate`.
- Modes as data: `MODES = { quick: {due: true, cap: QUICK_CAP, newItems: null}, … }` instead of nested ternaries.
- `session.js` re-exports everything so every import and ARCHITECTURE signature still works.
- Before splitting, add a golden test: `buildSession` output for each mode on a fixed seed and fixture, compared before and after.

## Acceptance criteria

- [ ] No new file over 300 lines; no function over 40 lines.
- [ ] The golden test passes unchanged.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
