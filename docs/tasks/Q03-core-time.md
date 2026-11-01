# Q03 · One time module: `core/time.js`

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | none |
| **Can run in parallel with** | Q02, Q06, Q07, Q16, Q17 |

## Owns (files you may create or change)

- `app/js/core/time.js` (new, pure)
- `test/time.test.mjs` (new)
- Day-constant lines only in: `core/{cards,session,fsrs,mastery,pace,carrier}.js`, `data/store.js`, `ui/views/{dashboard,summary}.js`
- `docs/ARCHITECTURE.md` §1 (layout line)
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- ARCHITECTURE §1 Layout, §8 Sessions (`nextDayStart`, `dayKey`)

## Goal

A day is defined nine times under three spellings (`DAY`, `DAY_MS`, `864e5`, raw `86400000`), and `session.js` has both `nextDayStart(now)` and `daysAfter(now, n)`, which are the same function. `dayKey` lives in `session.js`, so modules import the whole session engine just to name a day.

## Spec

- `core/time.js` exports `DAY_MS`, `dayKey(now)` (local `YYYY-MM-DD`), `startOfDayPlus(now, n)` (local midnight `n` days after `now`'s day).
- `session.js`: `nextDayStart = (now) => startOfDayPlus(now, 1)`; remove `daysAfter`; keep exporting `nextDayStart` and `dayKey` (re-export) so ARCHITECTURE §8 holds.
- Replace every local day constant with `DAY_MS` from `time.js`.
- Tests: `dayKey` and `startOfDayPlus` across a DST change and month/year ends (use `TZ`-independent assertions: compare against `new Date(y, m, d)` built in the test).

## Acceptance criteria

- [ ] `grep -rnE "86400000|864e5" app/js` finds only `core/time.js`.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
