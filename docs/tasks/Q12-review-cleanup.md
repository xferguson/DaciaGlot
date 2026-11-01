# Q12 · Review transitions: one attempt builder, clear names, no hidden side effects

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | Q11 |
| **Can run in parallel with** | none (core lane is serial) |

## Owns (files you may create or change)

- `app/js/core/review.js`, `app/js/core/queue.js` (from Q11)
- `app/js/core/cards.js` (`isEasy`, `erUnlocked` signatures)
- related tests
- `docs/ARCHITECTURE.md` §3, §8
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- ARCHITECTURE §4.3 Attempt, §8

## Goal

Small correctness traps found in the audit:
- Attempt records `{u, lx, c, t, card}` are built three different ways (`applyReview`, `applyErReview`, `applyCheck` with `enc: 1`).
- `composeSession` has a local `Set` named `claimed` meaning "already assigned", next to `state.claimed` meaning FR-R4 claims.
- `.filter((id) => … && !claimed.has(id) && claimed.add(id))` hides a mutation inside a filter predicate.
- `applyErReview` reassigns its `misses` parameter.
- `isEasy(state, unit, _now)` ignores `now`; `erUnlocked` is called with `now` in some places and without in others.

## Spec

- `makeAttempts(units, correct, now, presentedId, {enc} = {})` used by all three transitions.
- Rename the local set to `assigned`; replace the filter-with-side-effect by a `takeOnce(set)` helper or an explicit loop.
- No parameter reassignment in core (add to the Q16 lint).
- Settle one signature for `isEasy`/`erUnlocked` (drop `now` everywhere or use it everywhere); update ARCHITECTURE §3.

## Acceptance criteria

- [ ] Lint rule "no parameter reassignment in core" is on with an empty allowlist.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
