# Q04 · Day history in one place; break the session ↔ pace import cycle

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | Q03 |
| **Can run in parallel with** | Q02, Q06/Q10, Q07, Q16, Q17 |

## Owns (files you may create or change)

- `app/js/core/history.js` (new, pure)
- `test/history.test.mjs` (new)
- `app/js/core/session.js` (`bumpDay`, `addMinutes`)
- `app/js/core/pace.js` (`recordSession` day record, `dayKey` import)
- `app/js/ui/views/dashboard.js` (`dayKey` import only)
- `docs/ARCHITECTURE.md` §4.2, §8.1
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- ARCHITECTURE §4.2 Flag and DayStats, §8, §8.1

## Goal

`core/pace.js` imports `dayKey` from `session.js` and `session.js` imports `learnBatch` from `pace.js`: a cycle that only works because neither uses the other at load time. The empty day record `{ minutes: 0, cards: 0, newSentences: 0, formsProduced: 0 }` is written twice (`session.js` `bumpDay`, `pace.js` `recordSession`), so a new field drifts.

## Spec

- `core/history.js`: `emptyDay()`, `bumpDay(history, now, fn)` (returns a new history; `fn` gets a copy), `addMinutes(state, minutes, now)`. Imports only `time.js`.
- `session.js` re-exports `addMinutes` (ARCHITECTURE §8). `pace.js` uses `bumpDay` for `newItems` and imports `dayKey` from `time.js`; it no longer imports `session.js`.
- `emptyDay()` includes `newItems: 0`; update §4.2 to list it (it was undocumented).

## Acceptance criteria

- [ ] No import cycle among `app/js/core/*.js` (add a test that walks the import graph and fails on a cycle).
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
