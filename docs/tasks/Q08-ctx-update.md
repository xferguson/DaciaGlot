# Q08 · One state-update path for views: `ctx.update`

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | Q02 |
| **Can run in parallel with** | Q05, Q13, Q09 |

## Owns (files you may create or change)

- `app/js/main.js` (`ctx.update`, `ctx.updateSettings`)
- `app/js/ui/views/{session,settings,cando,home,lists}.js` (state writes only)
- `test/views-*.test.mjs` (fake `ctx` gains `update`)
- `docs/ARCHITECTURE.md` §1 (the `ctx` shape)
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- ARCHITECTURE §1 Layout (`ctx`), §4.5 Store API

## Goal

Views write state by hand about a dozen times: `ctx.state = { ...ctx.state, settings: { ...ctx.state.settings, ...patch } }; ctx.store.save(ctx.state);`. Some paths save twice (the session view's `onResult`).

## Spec

- `ctx.update(fn)`: `ctx.state = fn(ctx.state); ctx.store.save(ctx.state); return ctx.state`. `ctx.updateSettings(patch)` wraps it.
- Every view state write goes through these with a pure core transition (`claimForm`, `markDifficult`, `applyReview`, …) or a settings patch. One save per user action.
- Document `ctx` in ARCHITECTURE §1.

## Acceptance criteria

- [ ] `grep -rn "ctx.state = " app/js/ui` finds nothing.
- [ ] Q02's session tests show exactly one `save` per answered card.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
