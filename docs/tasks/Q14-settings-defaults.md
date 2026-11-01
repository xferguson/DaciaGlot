# Q14 · Settings defaults in one place; cards get a ready `speak`

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | Q05 |
| **Can run in parallel with** | Q08, Q09, Q13, Q15 |

## Owns (files you may create or change)

- `app/js/data/store.js` (export `SETTINGS_DEFAULTS`)
- `app/js/core/pace.js` (`PACE_TARGET_DEFAULT`, fallbacks)
- `app/js/ui/views/{session,settings}.js`, `app/js/ui/views/card-*.js` (fallbacks and `speak` only)
- `docs/ARCHITECTURE.md` §4
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- ARCHITECTURE §4 Persisted state, §10 TTS

## Goal

`settings.ttsRate ?? 0.9` is repeated in all seven card views; `?? 15` for `paceTarget` and `newItemsPerLearn` appears in the session view, settings view and `pace.js`, while `store.js` and `PACE_TARGET_DEFAULT` hold their own copies. Each card builds its own `speak` from `tts` + rate.

## Spec

- One `SETTINGS_DEFAULTS` object (in `store.js`, or a tiny `core/settings.js` if core needs it). `withDefaults` already fills missing settings on load, so remove the scattered `??` fallbacks.
- The session view passes cards `speak(text, opts)` already bound to the rate; cards stop reading `tts`/`ttsRate`.

## Acceptance criteria

- [ ] `grep -rnE "\?\? (0\.9|15)\b" app/js` finds nothing.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
