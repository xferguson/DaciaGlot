# T24 · Verify batch B paradigms against Dexonline

| | |
|---|---|
| **Phase** | 2 |
| **Depends on** | T17 |
| **Can run in parallel with** | any task that does not edit `app/content/lexemes/**` |

## Owns (files you may create or change)

- `app/content/lexemes/batch-b.json`, `app/content/lexemes/core.json` (form corrections only)
- `app/content/sentences/**` (only where a corrected form appears in `ro`, `accept`, `tokens` or `transforms`)
- `docs/tasks/T24-dexonline-check.md` (the results table below)

## Read first (only these)

- CONTENT_GUIDE §2.1 (lexeme forms), §8 rule 5 (check forms against Dexonline)
- The "Paradigm sources and uncertainties" section of PR #33

## Goal

Every inflected form added in T17 (`lexemes/batch-b.json` plus the plural and `subj1pl` forms added to `core.json`) is checked against its Dexonline paradigm table, and wrong forms are fixed.

## Spec

- Check each lexeme in `batch-b.json` and each form T17 added to `core.json` against https://dexonline.ro.
- Check the T17 uncertainty list first: *prezice, plăcea, dimineață, cald, crește*, the *-ez* classification of *interesa, optimiza, vota, rula, livra, analiza*, plural-only *sarmale* and *date*, and the hyphenated loan plurals (*task-uri, bug-uri, pipeline-uri, feedback-ul, hobby-ul*).
- Where Dexonline disagrees, fix the lexeme form and every sentence that uses it. Bump `contentVersion`.
- Record the outcome per lexeme in the results table below: confirmed, corrected (old → new), or unverifiable.
- Anything Dexonline cannot settle (register, naturalness, the English glosses) goes to the user, not into the content.

## Acceptance criteria

- [ ] Every lexeme in `batch-b.json` has a row in the results table.
- [ ] `node --test` and `node scripts/validate-content.mjs --phase 2` pass.
- [ ] Corrections, if any, listed at the top of the PR description.

## Out of scope

Naturalness review of whole sentences, and any content beyond batch B.

## Results

_(filled in as the check proceeds)_
