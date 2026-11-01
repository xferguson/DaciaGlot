# Q07 · Safe markup helpers: `ui/dom.js`

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | none |
| **Can run in parallel with** | Q02, Q03, Q06, Q16, Q17 |

## Owns (files you may create or change)

- `app/js/ui/dom.js` (new)
- `test/dom.test.mjs` (new)
- `app/js/ui/views/{cando,settings,summary}.js` (`esc`)
- `app/js/ui/components/feedback.js` (its private `el`)
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- CLAUDE.md · Ground rules (UI)

## Goal

There are three different `esc` functions: `cando.js` and `settings.js` escape `& < > "`, `summary.js` skips `"` (unsafe in an attribute), and only one handles `null`. About twenty views write template literals into `innerHTML`, some with unescaped values (`data-card="${card?.id ?? card}"`).

## Spec

- `ui/dom.js`: `esc(value)` (`& < > " '`, `null`/`undefined` → `""`), `el(tag, props, ...children)`, and a tagged template `` html`…` `` that escapes every interpolation unless it is a `raw(...)` value.
- Replace the three `esc` copies and `feedback.js`'s `el`. Convert the `innerHTML` writes that interpolate data in `cando`, `settings`, `summary` to `html`.
- Do not touch the card views or `session.js` (Q05/Q08 own them); list their remaining `innerHTML` interpolations in the PR for those tasks.

## Acceptance criteria

- [ ] `grep -rn "const esc" app/js` finds nothing outside `ui/dom.js`.
- [ ] A test shows `esc('"><img>')` is inert inside an attribute.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
