# T23 · Content batch C: Stages 1–2 complete (400–600)

| | |
|---|---|
| **Phase** | 3 |
| **Depends on** | T17, T19, T22 |
| **Can run in parallel with** | T18, T20, T21 |

## Owns (files you may create or change)

- `app/content/**`

## Read first (only these)

- PRD §4.1 (FR-C8), §7 (Phase 3 criteria)
- CONTENT_GUIDE (all)

## Goal

Fill every A1 gap the coverage report shows.

## Spec

- Drive entirely from `--coverage`: bring every A1 pattern to ≥10 sentences and ≥6 head lexemes, every can-do to ≥5 sentences, every situation to ≥25, and every lexeme to ≥2 sentences.
- Total 400–600. Then enable `--strict-a1` in CI.

## Acceptance criteria

- [ ] CI is green with `--strict-a1` enabled.
- [ ] Paradigm sources and uncertainties listed in the PR.
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.
