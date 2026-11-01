# T33 · Fast intake in Learn mode

| | |
|---|---|
| **Phase** | 3.6 |
| **Depends on** | T32 (same `session.js`; run after it to avoid conflicts) |
| **Can run in parallel with** | T35 |
| **Experiment** | [EXP-08](../EXPERIMENTS.md#exp-08--fast-intake-romance-fast-track--t33-t34) |

## Owns (files you may create or change)

- `app/js/core/session.js` (`learnPlan`, `mixPlan` floor, Learn batch by new items)
- `app/js/core/select.js` (pick by new-item count, not sentence count)
- `app/js/ui/views/card-lr.js` (one tap, auto-advance on a correct pick)
- `app/js/ui/views/home.js` (Learn button estimate), `app/js/ui/views/settings.js` (`newItemsPerLearn`)
- `app/js/data/store.js` (setting default only)
- `test/session.test.mjs`, `test/select.test.mjs`
- `app/js/version.js`, `app/sw.js` (version only)
- `docs/ARCHITECTURE.md` §8, `docs/PRD.md` FR-S7, FR-S10, new FR-V2; `docs/EXPERIMENTS.md` EXP-08 status

## Read first (only these)

- `docs/EXPERIMENTS.md` · Check-in 2026-11-01 and EXP-08
- PRD §4.2 (FR-D1), §4.4, §4.8 (FR-R2), §4.9
- ARCHITECTURE §6.2, §8

## Goal

The owner's benchmark is Memrise: 10–20 new items in 5–10 minutes. Learn mode gives 8 sentences at ~40 s each. Make Learn mode deliver ~15–20 new items in ~10 minutes, recognition first, with the counted production test the next day (FR-R2 stays).

## Spec

- A **new item** is a new lexeme-form unit or a new sentence with no new form. Setting `newItemsPerLearn` (default 15, range 5–40) replaces `newPerSession` for Learn mode (keep `newPerSession` for Session mode).
- `learnPlan(state, content, focus, now, rng)` picks new sentences until the new-item count reaches the setting (paradigm batches count each member's new forms).
- `lr` speed: a correct pick plays the sentence once and auto-advances after it ends (≤ 2 s); a wrong pick shows the answer and waits for Continue. Estimated time per new sentence drops to `SEC_PER_NEW_FAST` (measure: target ≤ 25 s including its share of the combined check).
- The one combined check per sentence (T31) is kept, `CHECK_GAP` unchanged. With 15+ items there's room for it.
- Mix mode: new material never drops below `MIX_MIN_NEW` (3 sentences) because of reviews; the review part is trimmed to fit `MIX_BUDGET_SEC` instead (oldest-due first stay).
- Home's Learn button shows "~N new · ~M min".

## Acceptance criteria

- [ ] Tests: Learn with default settings yields 15 ± 2 new items; paradigm batches counted by forms.
- [ ] Tests: Mix with 200 due cards still adds `MIX_MIN_NEW` new sentences and stays within the budget.
- [ ] Tests: FR-R2 still holds (first counted test next day; one check ≥ 8 cards after its `lr`).
- [ ] Headless run (phone width): a correct `lr` pick auto-advances; a wrong one waits.
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
