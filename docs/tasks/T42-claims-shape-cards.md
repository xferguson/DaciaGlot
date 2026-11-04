# T42 · Claims shape the cards: no tests of what you've claimed, one card instead of two

| | |
|---|---|
| **Phase** | 3.7 |
| **Depends on** | T38 (a correct `er` part credits its `fm` card) |
| **Can run in parallel with** | T37, T39, T40, T41 |
| **Experiment** | [EXP-12](../EXPERIMENTS.md#exp-12--credit-what-you-already-know--t38t42) |

## Owns (files you may create or change)

- `app/js/core/queue.js`: a new pipeline step `dropClaimDuplicates`, after `selectDue`
- `app/js/core/cards.js`: `erUnlocked`, plus a new `claimCheckDue`
- `test/claims-cards.test.mjs` (new), `test/session-golden.test.mjs` fixture (regenerate if needed, say why)
- `app/sw.js` precache + version, `app/js/version.js`
- `docs/PRD.md` FR-R4, FR-R3; `docs/ARCHITECTURE.md` §8; `docs/EXPERIMENTS.md` EXP-12

## Read first (only these)

- `docs/EXPERIMENTS.md` · Check-in 2026-11-04 and EXP-12
- PRD FR-R3, FR-R4, FR-V1; ARCHITECTURE §8 (`composeSession`, `isClaimedCard`, `erUnlocked`)

## Goal

"How often am I being tested on something I've marked *I can produce this*?" Claimed forms never get their own `fm` card, but:

- A sentence made **only** of claimed words still becomes a full EN→RO card.
- A sentence where all but one word is claimed is tested twice: as its `er` card and as that last word's `fm` card.

## Spec

- **All claimed.** An `er:<sid>` whose cloze units are all claimed is not due, except for a **claim check** at most every `CLAIM_CHECK_DAYS` = 60 days.
  - `claimCheckDue(sid, state, now)` decides it from the card's `lastReview`.
  - A wrong claim check drops the missed claims, as today (T28/T27 behavior unchanged).
- **All but one claimed.** If `er:<sid>` and `fm:<X>` are both due and X is the sentence's only unclaimed cloze unit, keep the `er` card and drop `fm:X` from this session's queue.
  - T38 makes a correct answer credit `fm:X`. A wrong answer already fails it.
  - When the `er` card isn't due, `fm:X` is reviewed normally.
- No change to claiming or unclaiming, or to the word sheet.

## Acceptance criteria

- [ ] Tests:
  - All-claimed `er` is hidden until 60 d since its last review, then due once.
  - The all-but-one case queues one card, not two.
  - When `er` isn't due, `fm` stays.
  - A wrong claim check drops claims (existing behavior).
- [ ] `node --test`, `node scripts/validate-content.mjs` and `node scripts/lint.mjs` pass. STATUS updated.
