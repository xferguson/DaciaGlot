# Q06 · Shared randomness helpers: `core/random.js`

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | none |
| **Can run in parallel with** | Q02, Q03, Q07, Q16, Q17 |

## Owns (files you may create or change)

- `app/js/core/random.js` (new, pure)
- `test/random.test.mjs` (new)
- `app/js/core/cards.js` (`tileOptions` shuffle)
- `app/js/core/session.js` (random picks in `onePerFamily` and the paradigm `chosen`)
- `app/js/ui/views/card-lr.js` (`shuffle` moves out; re-export it)
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- CLAUDE.md · Ground rules (core is pure)

## Goal

`shuffle` exists twice: exported from a view (`card-lr.js`) and inline in `core/cards.js`. `Math.min(n - 1, Math.floor(rng() * n))` is hand-written in several places.

## Spec

- `core/random.js`: `shuffle(arr, rng)` (Fisher–Yates, returns a copy), `pickIndex(rng, n)`, `pickOne(arr, rng)`. `rng` is required.
- **Keep the exact sequence of `rng()` calls** each caller makes today, so seeded tests and saved behavior don't shift. Add a test per call site that a fixed-seed `rng` gives today's result.
- `card-lr.js` imports `shuffle` from core and re-exports it for one release.

## Acceptance criteria

- [ ] `grep -rn "Math.floor(rng() \*" app/js` finds only `core/random.js`.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
