# T11 · Mastery derivation and attempt compaction

| | |
|---|---|
| **Phase** | 2 |
| **Depends on** | T08 |
| **Can run in parallel with** | T12, T14, T15, T16, T17 |

## Owns (files you may create or change)

- `app/js/core/mastery.js`
- `app/js/data/store.js` (compaction hook only)
- `test/mastery.test.mjs`

## Read first (only these)

- PRD §3 (P-4, P-6), §4.5 (FR-P1, P2), §4.7 (FR-X5)
- ARCHITECTURE §4.3, §7

## Goal

Pure functions that turn attempts into pattern, unit and sentence states.

## Spec

Implement ARCHITECTURE §7.1–7.3 as `patternState(id, state, content, now)`, `unitState(unitId, …)`, `sentenceMastered(id, …)`, plus `allPatternStates()` for the lists UI. Read both `attempts` and `unitAggregates`.
- `compactAttempts(state, now)` folds attempts older than 90 days into `unitAggregates` (pure). Call it from `store.load()` at most once per day (`lastCompactionAt`).
- Accuracy windows use the last 20 attempts *after* compaction; when there are fewer than 20 raw attempts, fill from aggregates by treating their ratio as representative.

## Acceptance criteria

- [ ] Table-driven tests for each state boundary (e.g. 4 vs 5 lexemes, 69% vs 70%).
- [ ] Compaction preserves total and correct counts and distinct lexemes; idempotent.
- [ ] Results don't change across a compaction (state before == after for every pattern in a fixture).
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

Dashboard rendering (T18).
