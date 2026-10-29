# T15 · Transformation and slot-building cards

| | |
|---|---|
| **Phase** | 2 |
| **Depends on** | T08, T11 |
| **Can run in parallel with** | T12, T14, T16, T17 |

## Owns (files you may create or change)

- `app/js/ui/views/card-transform.js`
- `app/js/ui/views/card-slot.js`
- `app/js/core/cards.js` (xf/sb unlock + slot derivation)
- `test/cards-xf.test.mjs`

## Read first (only these)

- PRD §4.2 (FR-D4, D5, D9)
- ARCHITECTURE §3
- CONTENT_GUIDE §2.3 (transforms), §3

## Goal

The learner's top-ranked drill: produce a changed sentence from a known one.

## Spec

- `xf`: shows the source `ro` (with replay), the instruction rendered from the op (CONTENT_GUIDE §3 table; one renderer function `opInstruction(op)` in `cards.js`), and an input for the full sentence. Checking uses `checkAnswer(input, t.ro, t.accept)`. Attempts are the units of `targetTokens` in the *result*: derive them by aligning result tokens to source tokens; tokens that differ get units looked up from the lexicon by form match. If the lookup is ambiguous, record only the pattern units.
- `sb`: derive slots from the transform. Unchanged content tokens appear as plain lemmas, and changed ones as `[slotLabel]` chips from their patterns, e.g. `[nu] + [past] + termina + sprint`. The answer is the transform's `ro`.
- Unlock per FR-D4/D5. Card-type weighting per FR-D9 when several are due for the same sentence (show only one per sentence per session).

## Acceptance criteria

- [ ] Tests: `opInstruction` for every op; unlock conditions; slot derivation for 3 fixture transforms including a clitic cluster.
- [ ] Manual: an `xf` negate card on *Ieri am terminat sprintul.* accepts both *n-am* and *nu am*.
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

Generated (non-authored) transforms.
