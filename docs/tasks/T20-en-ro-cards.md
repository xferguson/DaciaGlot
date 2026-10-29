# T20 · EN→RO cards

| | |
|---|---|
| **Phase** | 3 |
| **Depends on** | T08, T15 |
| **Can run in parallel with** | T18, T19, T21, T22, T23 |

## Owns (files you may create or change)

- `app/js/ui/views/card-enro.js`
- `app/js/core/cards.js` (er unlock)
- `test/cards-er.test.mjs`

## Read first (only these)

- PRD §4.2 (FR-D6, D7, D9)

## Goal

The hardest production drill, unlocked only when the sentence is solid.

## Spec

- Unlock per FR-D6. The prompt shows `en` only, then a full-sentence input with the diacritic bar. Reveal-audio button available after the first wrong attempt.
- Attempts: every unit of every `cloze: true` token plus pattern units (heads).
- Lowest weight among card types (FR-D9).

## Acceptance criteria

- [ ] Tests: unlock threshold; attempt units.
- [ ] Manual: accepts `accept[]` variants and contractions.
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.
