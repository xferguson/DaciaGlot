# T03 · Answer checking: normalize, equivalences, diff

| | |
|---|---|
| **Phase** | 1 |
| **Depends on** | none |
| **Can run in parallel with** | T01, T02, T04, T05, T06 |

## Owns (files you may create or change)

- `app/js/core/normalize.js`
- `app/js/core/equivalences.js`
- `app/js/core/check.js`
- `test/check.test.mjs`

## Read first (only these)

- PRD §4.3 (FR-A1…A4)
- ARCHITECTURE §5

## Goal

Pure, well-tested answer checking that is lenient on diacritics and contractions and pinpoints the wrong tokens.

## Spec

Implement the ARCHITECTURE §5 API exactly.
- Comparison uses normalized tokens. The equivalence table expands *both* the expected answer and every `accept` entry into canonical form before comparing (map each equivalence set to its first member, matching two-token spans before single tokens).
- `correct-diacritics`: when the input matches only after `stripDiacritics`, mark `status: "diacritic"` on the expected tokens whose diacritics differ.
- Diff: LCS on canonical tokens. Expected tokens not in the LCS are `wrong` if an input token sits at the aligned gap, otherwise `missing`. Unaligned input tokens go in `extra`.
- Punctuation inside tokens (*„…"*, commas) is stripped for comparison but preserved in the `token` field of the output.

## Acceptance criteria

- [ ] Tests cover: exact; case and whitespace; cedilla→comma; missing diacritics; *n-am* vs *nu am* both directions; *mi-e* vs *îmi este*; one wrong token; a missing token; an extra token; punctuation differences; an `accept` alternative.
- [ ] 100% of exported functions have tests; `node --test` passes.
- [ ] No DOM or global usage (runs under plain Node).
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

UI highlighting (T07).
