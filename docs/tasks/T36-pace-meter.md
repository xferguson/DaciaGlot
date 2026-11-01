# T36 · Show the pace, adapt the batch

| | |
|---|---|
| **Phase** | 3.6 |
| **Depends on** | T33 (uses `newItemsPerLearn`) |
| **Can run in parallel with** | T34, T35 |
| **Experiment** | [EXP-10](../EXPERIMENTS.md#exp-10--show-the-pace--t36) |

## Owns (files you may create or change)

- `app/js/core/pace.js` (new, pure): `sessionPace`, `weeklyIntake`, `nextBatchSize`
- `app/js/ui/views/summary.js` (pace block first), `app/js/ui/views/dashboard.js` (weekly intake chart), `app/js/ui/views/settings.js` (`paceTarget`)
- `app/js/data/store.js` (defaults; `state.pace` history of last batch sizes)
- `test/pace.test.mjs`
- `app/sw.js` precache + version, `app/js/version.js`
- `docs/ARCHITECTURE.md` (new §8.1), `docs/PRD.md` FR-P5, FR-P6, new FR-V5; `docs/EXPERIMENTS.md` EXP-10 status

## Read first (only these)

- `docs/EXPERIMENTS.md` · Check-in 2026-11-01 and EXP-10
- PRD §4.5, §4.9
- ARCHITECTURE §4.3, §8

## Goal

"I need … any system I'm using to keep track of if I'm going fast enough to be excited." Show the owner their intake pace, and let Learn batches grow when they're coasting.

## Spec

- `sessionPace(attempts, exposures, startedAt, endedAt, content)` → `{newForms, newSentences, newPatterns: string[], minutes, perTen, reviewShare}`.
- Summary leads with: "New this session: **N** words · **M** sentences · first *pattern name*" and "**X** per 10 min (target T)". If no new items, say "Review session" plainly.
- Dashboard: weekly new items (bars, 8 weeks) beside the existing forms-produced chart.
- `nextBatchSize(current, perTen, target, checkAccuracy, min, max)`: under target and accuracy ≥ 85 % → ×1.25; accuracy < 60 % → ×0.75; otherwise unchanged; bounded by the setting range. Learn mode uses it when `adaptiveBatch` is on (default).
- Settings: `paceTarget` (default 15 per 10 min), `adaptiveBatch`.
- Everything is local and shown only to the learner; no export, no telemetry.

## Acceptance criteria

- [ ] Tests for all three pure functions, including bounds and an empty session.
- [ ] Headless run (phone width, light + dark): summary pace block; dashboard weekly intake chart.
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
