# Q15 · Remove the global claim handler

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | Q08 |
| **Can run in parallel with** | Q09, Q13, Q14 |

## Owns (files you may create or change)

- `app/js/ui/components/feedback.js`
- `app/js/ui/views/session.js` (registration only)
- card views that call `renderFeedback` (pass-through only)
- `test/views-*.test.mjs`
- `docs/ARCHITECTURE.md` (T28 note)
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- ARCHITECTURE §3 (claims), PRD FR-R4

## Goal

`feedback.js` keeps a module-level `let claims` that the session view sets and nothing clears; `openFormSheet` destructures it and crashes if it is still `null` (any view that renders feedback without a session).

## Spec

- `renderFeedback(slot, {…, claims})` takes the handler as an option; cards receive it in their render options from the session view (built from `ctx.update` + `claimForm`/`unclaimForm`).
- Without a handler, tokens stay plain word links (today's documented fallback).
- Remove `setClaimHandler`.

## Acceptance criteria

- [ ] `grep -rn "setClaimHandler" app/js` finds nothing.
- [ ] A test renders feedback with no handler and taps a token without a throw.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
