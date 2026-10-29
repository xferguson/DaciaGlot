# T19 · A1 level manifest and can-do tracking

| | |
|---|---|
| **Phase** | 3 |
| **Depends on** | T11 |
| **Can run in parallel with** | T20, T21, T22, T23 |

## Owns (files you may create or change)

- `app/content/levels/A1.json`
- `app/js/core/mastery.js` (levelProgress, canDoCheckable)
- `app/js/ui/views/cando.js`
- `test/levels.test.mjs`

## Read first (only these)

- PRD §4.5 (FR-P3, P4)
- ARCHITECTURE §7.3, §7.4
- CONTENT_GUIDE §2.4, §5

## Goal

Make 'have I finished A1?' an answerable question.

## Spec

- Write `A1.json`: `requiredPatterns` = all Stage 1–2 patterns; `targetLexemes` = the lexemes used in Stage 1–2 content with freq rank ≤ 1500 (generate, then review); `canDos` = 3–5 per situation (≈35 total), adapted from CEFR A1 descriptors to these situations, phrased "I can …".
- Link sentences to can-dos via `canDo[]` (edit existing sentence files; ids unchanged).
- Implement `levelProgress` and `canDoCheckable(id)` (all linked sentences mastered).
- `cando.js` view (embedded in the dashboard): a list per situation; checkable items show a checkbox; non-checkable ones show "k / n sentences mastered".

## Acceptance criteria

- [ ] Tests: `levelProgress` math per ARCHITECTURE §7.4; checkability.
- [ ] Validator passes; every can-do has ≥1 linked sentence (≥5 is T23's target).
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

A2 manifest (Phase 4).
