# Q10 · Enforce the pure core: required `rng`, no mutation

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | Q06 |
| **Can run in parallel with** | Q02, Q04, Q07, Q16, Q17 |

## Owns (files you may create or change)

- `app/js/core/{cards,carrier,session}.js` (signatures named below)
- `app/js/ui/views/session.js` (`requeueWrong` call site)
- `test/purity.test.mjs` (new), affected core tests
- `docs/ARCHITECTURE.md` §8
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- CLAUDE.md · Ground rules
- ARCHITECTURE §8

## Goal

CLAUDE.md says core takes `now` and `rng` as arguments, but `tileOptions`, `pickCarrier` and `pickComposite` default to `Math.random`, and `requeueWrong` mutates the queue it is given (the view relies on it).

## Spec

- Make `rng` required in those three (throw a clear `TypeError` when missing); update callers.
- `requeueWrong(queue, pos, item, rng, content) → {queue, at}` returns a new queue; the session view uses it. Update ARCHITECTURE §8.
- `test/purity.test.mjs`: no `Math.random`, `Date.now`, `new Date()` without an argument, `document`, `window`, `localStorage` or `navigator` in `app/js/core/*.js`, and no core function mutates its arguments (deep-freeze inputs in the existing session/cards tests' fixtures).

## Acceptance criteria

- [ ] Purity test passes and fails if `Math.random` is added to any core file.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
