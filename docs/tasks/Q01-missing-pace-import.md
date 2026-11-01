# Q01 · Fix the missing pace import (shipped in #87)

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | none |
| **Can run in parallel with** | n/a (done) |

## Owns (files you may create or change)

- `app/js/ui/views/session.js` (import only)
- `test/imports.test.mjs`

## Read first (only these)

- none

## Goal

T36 added calls to `sessionPace`, `recordSession` and `checkAccuracy` in the session view without importing them, so finishing a session threw before the summary and leaving one threw before the "answers saved" toast and `store.flush()`. Fixed by PR #87, which also added `test/imports.test.mjs` and a shared `ui/components/button.js`.

## Spec

Done. Follow-up: `test/imports.test.mjs` only checks names exported by some module, and it strips template literals whole, so a call inside `${…}` is never checked. Q16 replaces it with a stricter scanner.

## Acceptance criteria

- [x] Session finishes and exits without a page error (headless check, 2026-11-01).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
