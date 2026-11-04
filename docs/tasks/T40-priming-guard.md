# T40 · Priming guard: don't test a word you saw a few cards ago

| | |
|---|---|
| **Phase** | 3.7 |
| **Depends on** | T37 (`partialCredit`) |
| **Can run in parallel with** | T38, T39, T41, T42 |
| **Experiment** | [EXP-12](../EXPERIMENTS.md#exp-12--credit-what-you-already-know--t38t42) |

## Owns (files you may create or change)

- `app/js/core/priming.js` (new, pure): `shownUnits`, `isPrimed`, `deferPrimed`
- `app/js/ui/views/session.js`: keep a `shown` set for the session, call `deferPrimed` before each card, and pass `primed` to the review. T37 also edits this file (the requeue line), so keep your change separate.
- `app/js/core/review.js`: `applyReview` / `applyErReview` take a trailing `{ primed }` option. A primed success uses `partialCredit`.
- `test/priming.test.mjs` (new), `test/views-session.test.mjs` (a primed-card case)
- `app/sw.js` precache + version, `app/js/version.js`
- `docs/PRD.md` new FR-S14; `docs/ARCHITECTURE.md` §8; `docs/EXPERIMENTS.md` EXP-12

## Read first (only these)

- `docs/EXPERIMENTS.md` · Check-in 2026-11-04 and EXP-12
- T37's spec for `partialCredit`
- PRD FR-S11; ARCHITECTURE §8 (`spaceOut`, `burySiblings`)

## Goal

"If the first sentence contained the second sentence's word, then it's still in my working memory, so that doesn't really work." Bjork's storage/retrieval strength explains why: a right answer while the word is fresh adds little to long-term memory. `spaceOut` keeps related cards only 2 apart, and it only tracks *tested* words, not words that were merely on screen.

## Spec

- `shownUnits(item, sentence, content)`:
  - Every unit of every sentence the card puts on screen: its own sentence, and for `lr` the options.
  - Paradigm cards add all their members.
- The session view adds each card's `shownUnits` to the session's `shown` set when the card is displayed.
- `isPrimed(item, shown, content)`: any unit the card **tests** (`unitsRequiredForCard`) is in `shown` from an earlier card.
  - `lr` cards and the immediate checks of new sentences (`check`) are never primed, because they are meant to come soon.
- `deferPrimed(queue, pos, shown, content)` → `{ queue, deferred }`, called before showing `queue[pos]`.
  - If that card is primed, swap in the first unprimed card within the next `SPACING_WINDOW` (8).
  - If there is none, take the primed card out of the session (`deferred`). It stays due, and a later session or the next day picks it up.
- If a primed card is shown anyway (it is the only one left):
  - A correct answer gets **partial credit**: `partialCredit(card, PRIMED_CREDIT = 0.25, now)`. It doesn't count as a full review, isn't logged for calibration (T37), and doesn't change `baseGap`.
  - A wrong answer counts fully (grade 1), since missing it even while fresh is real information.
- The summary doesn't mention deferrals.

## Acceptance criteria

- [ ] Pure tests:
  - `shownUnits` for `lr` (options) and paradigms.
  - `isPrimed` ignores `lr` and checks.
  - `deferPrimed` swaps inside the window, defers when none is free, and keeps order otherwise.
- [ ] Fake-DOM session test:
  - A card whose tested word appeared earlier in the session is moved or deferred.
  - A forced primed success only moves `due` by a partial credit.
- [ ] `node --test`, `node scripts/validate-content.mjs` and `node scripts/lint.mjs` pass. STATUS updated.
