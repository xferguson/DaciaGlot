# Q18 · Close out: quote style, task template, allowlists at zero

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | Q02–Q17 |
| **Can run in parallel with** | none (last) |

## Owns (files you may create or change)

- `app/js/data/store.js`, `app/js/core/{check,equivalences}.js`, `test/helpers/*.mjs` (quote style only)
- `scripts/lint.mjs`, `scripts/lint-allow.json`
- `docs/tasks/` template note in `docs/STATUS.md` header
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- CLAUDE.md
- `docs/tasks/Q00-code-quality-overview.md`

## Goal

Finish the track: make the remaining style consistent and make the guards permanent.

## Spec

- Convert single-quoted modules to double quotes (one mechanical commit) and add the quote rule to the lint.
- Shared tie-break comparator: replace the repeated `(a < b ? -1 : 1)` with `cmpStr`/`byKey` from a small `core/sort.js`.
- Every allowlist in `lint-allow.json` is empty; delete the file and the allowlist code path.
- Add to the STATUS header: "Task files list a standing criterion: view changes have a fake-DOM test and `node scripts/lint.mjs` passes."

## Acceptance criteria

- [ ] `lint-allow.json` is gone and the lint passes.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
