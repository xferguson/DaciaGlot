# Q13 · Pure models out of views; views never import views

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | Q02 |
| **Can run in parallel with** | Q05, Q08, Q09 |

## Owns (files you may create or change)

- `app/js/ui/models/*.js` (new; or `core/` when no UI wording is involved)
- `app/js/ui/views/{dashboard,lexeme,lists,summary,card-lr,card-paradigm,home,session}.js` and `app/js/main.js` (imports and moved functions only)
- `test/{dashboard,lists,summary,card-lr,families}.test.mjs` (import paths only)
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- ARCHITECTURE §1 Layout

## Goal

Views import from other views (`main.js` ← `summary.js`, `session.js` ← `lists.js`, `home.js` ← `lists.js`), and tests import pure functions from views (`dashboardModel`, `lexemeModel`, `listRows`, `readyCount`, `parseFocusParam`, `exportReminderDue`, `pickDistractors`, `paradigmRows`, `diffPatternStates`, …).

## Spec

- Move each pure helper to `ui/models/<view>.js` (or `core/` if it has no display wording). Re-export from the view for one release.
- Rule: a view imports from `core/`, `data/`, `ui/components/`, `ui/models/` and `ui/dom.js` only. If Q16 has landed, shrink its import-direction allowlist to zero.
- Don't touch `card-cloze.js` `hintFor` (Q05 moves it).

## Acceptance criteria

- [ ] No `ui/views/*` file imports another `ui/views/*` file.
- [ ] No test imports from `ui/views/`.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
