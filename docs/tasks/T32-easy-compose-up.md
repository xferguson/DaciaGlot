# T32 · Easy becomes harder work: composite reviews, whole sentence sooner

| | |
|---|---|
| **Phase** | 3.6 |
| **Depends on** | none (builds on T25, T27, T28) |
| **Can run in parallel with** | T35, T36 (different files) |
| **Experiment** | [EXP-07](../EXPERIMENTS.md#exp-07--easy-becomes-harder-work--t32) (also revises EXP-03) |

## Owns (files you may create or change)

- `app/js/core/cards.js` (`isEasy`, `erUnlocked`)
- `app/js/core/carrier.js` (`pickComposite`)
- `app/js/core/session.js` (composite queue items in `buildSession`; grading via `applyErReview`)
- `app/js/ui/views/card-enro.js`, `app/js/ui/views/session.js` (show a composite as an `er`; label "Review · N forms")
- `test/cards.test.mjs`, `test/carrier.test.mjs`, `test/session.test.mjs`
- `app/js/version.js`, `app/sw.js` (version only)
- `docs/ARCHITECTURE.md` §3, §8; `docs/PRD.md` FR-D6, FR-R3, new FR-V1; `docs/EXPERIMENTS.md` EXP-07 status

## Read first (only these)

- `docs/EXPERIMENTS.md` · Check-in 2026-11-01 and EXP-07
- PRD §4.2 (FR-D6), §4.8 (FR-R1, R3, R4), §4.9
- ARCHITECTURE §3, §8

## Goal

The owner: "If something is easy, chunk it into harder material instead of wasting time reviewing." Easy forms shouldn't each get their own review. They should be reviewed together inside one whole sentence the owner produces, and whole-sentence tests should come as soon as a sentence's forms are easy.

## Spec

- `isEasy(state, unit, now)`: the form is claimed, **or** its `fm` card's last counted grade was Easy (4), **or** its gap (`due - lastReview`) is ≥ `ER_MIN_GAP_DAYS`.
- `erUnlocked` (FR-D6/FR-R3): every cloze unit of the sentence is easy (replaces the gap-only rule).
- `pickComposite(dueEasyUnits, state, content, now, rng)` → `{sentenceId, units}` | null: the sentence (seen or unseen) whose cloze units cover the most due easy forms, needing ≥ 2, with every *other* unit known (`isKnown` or claimed), not used as a carrier in the last 7 days. Prefer a sentence the owner hasn't seen. Ties → rng.
- `buildSession` (review, mix, quick): before `burySiblings`, take the due `fm` cards whose forms are easy and greedily replace them with composite items `{cardId: "er:<sid>", composite: true, units}` (≤ 4 forms each) until no composite of ≥ 2 forms is left. Forms that fit no composite stay as single `fm` reviews. An unseen composite sentence becomes seen (exposure) when shown.
- Grading: `applyErReview` with part-level `misses` (T27). Correct units get their `fm` reviewed Good (or Easy if the learner rates Easy); missed units get Again as now. A composite never introduces a new form: if the chosen sentence has an unseen form, it isn't eligible.
- Time estimate: a composite counts as `SEC_PER_REVIEW × 2`.

## Acceptance criteria

- [ ] Tests: `isEasy` for claimed, last-grade-Easy, and gap ≥ 4 d; not for a Good at 1 d.
- [ ] Tests: `erUnlocked` true once every cloze form is easy (no 4-day wait after an Easy).
- [ ] Tests: `pickComposite` covers the most due easy forms, never picks a sentence with an unknown other unit, needs ≥ 2.
- [ ] Tests: a review session with 6 due easy forms that fit 2 sentences yields 2 composite items and no single `fm` for those forms; part-level grading reschedules each form.
- [ ] Headless run (phone width): a composite card shows the English, is graded per part, and is labelled with its form count.
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated; ARCHITECTURE/PRD contract changes called out at the top of the PR.
