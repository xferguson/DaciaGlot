# T22 · Content coverage report in CI

| | |
|---|---|
| **Phase** | 3 |
| **Depends on** | T02 |
| **Can run in parallel with** | T18, T19, T20, T21, T23 |

## Owns (files you may create or change)

- `scripts/validate-content.mjs` (coverage)
- `.github/workflows/deploy-pages.yml` (run coverage, upload as job summary)
- `test/validate.test.mjs`

## Read first (only these)

- PRD §4.1 (FR-C5), §7 (Phase 3 criteria)
- CONTENT_GUIDE §4 (coverage)

## Goal

Tell content authors exactly where the gaps are.

## Spec

- `--coverage` prints Markdown tables: per pattern (sentences, distinct head lexemes, glue-cloze count), per situation, per can-do, and lexemes with < 2 sentences (`kf` would never unlock). Below-target rows are marked ⚠.
- `--strict-a1` exits 1 if any A1 can-do has < 5 sentences or any A1 pattern is below target. Enable it in CI **only** once T23 lands (leave it commented with a note until then).
- CI appends the report to `$GITHUB_STEP_SUMMARY`.

## Acceptance criteria

- [ ] The report renders in the Actions job summary on the PR.
- [ ] `--strict-a1` behavior covered by fixture tests.
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.
