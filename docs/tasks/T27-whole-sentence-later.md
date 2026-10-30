# T27 · Whole sentence later, with part-level credit

| | |
|---|---|
| **Phase** | 3.5 |
| **Depends on** | T25, T26 |
| **Can run in parallel with** | T28, T29, T30 |
| **Experiment** | [EXP-03](../EXPERIMENTS.md#exp-03--whole-sentence-later-part-level-credit--t27) |

## Owns (files you may create or change)

- `app/js/core/cards.js` (`er` unlock, `erUnits`), `app/js/core/session.js` (`applyErReview` or an `applyReview` extension)
- `app/js/ui/views/card-enro.js`, `app/js/ui/views/session.js`
- `test/cards-er.test.mjs`, `test/session.test.mjs`
- `app/js/version.js`, `app/sw.js` (version only)
- `docs/ARCHITECTURE.md` §8; `docs/PRD.md` FR-D6, FR-S3 (**contract change**)

## Read first (only these)

- PRD §4.2 (FR-D6), §4.3 (FR-A3, A4), §4.4 (FR-S1–S3), §4.8 (FR-R3)
- ARCHITECTURE §5, §8
- `docs/EXPERIMENTS.md` · EXP-03

## Goal

Once a sentence's new forms have settled, test the whole sentence (EN→RO, typed). If the learner misses a part, **that part** goes back to single-form review. The whole sentence isn't re-drilled.

## Spec

- **Unlock (FR-D6, revised):** `er:<sid>` unlocks when every `cloze: true` lexeme-form unit of the sentence has an `fm` card with a scheduled gap ≥ 4 days (the second ladder rung), or is claimed (T28, when present).
- **Grading:**
  - Run `checkAnswer(input, sentence.ro, accept)` (`core/check.js`) and use its token alignment.
  - For each expected token marked `wrong`/`missing`, its lexeme-form units get an attempt `c: 0`. Their `fm` card gets **Again** (grade 1) and so returns as a single-form review.
  - For each `ok` token, units get an attempt `c: 1`, and their `fm` schedule is **not** changed.
  - The `er` card itself is graded as today (`gradeFromResult`). One wrong token still grades `er` as wrong, but it waits for the ladder, not for a same-session re-queue.
- **Claims (if T28 is merged):** a wrong token whose unit is in `state.claimed` removes the claim and creates its `fm` card due now (evidence wins).
- Feedback names the parts that will come back: "*locuiește* will be reviewed on its own."

## Acceptance criteria

- [ ] Tests: unlock needs every cloze unit at ≥ 4 d.
- [ ] Tests: one wrong token → only that unit's `fm` gets Again; other units get `c: 1` attempts and unchanged `fm` schedules.
- [ ] Tests: contraction-equivalent answers (*n-am* / *nu am*) don't blame a token.
- [ ] Tests (with T28): a miss on a claimed unit removes the claim and creates the `fm`.
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. `docs/STATUS.md` updated. EXP-03 is `live since <merge date>`.
