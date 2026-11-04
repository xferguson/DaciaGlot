# T39 · Familiarity credit: words you met in context wait a bit longer

| | |
|---|---|
| **Phase** | 3.7 |
| **Depends on** | T37 (`partialCredit`), T38 (the early-production hook) |
| **Can run in parallel with** | T40, T41, T42 |
| **Experiment** | [EXP-12](../EXPERIMENTS.md#exp-12--credit-what-you-already-know--t38t42) |

## Owns (files you may create or change)

- `app/js/core/familiarity.js` (new, pure): `exposureCredit`, `FAMILIARITY` constants
- `app/js/core/credit.js`: fill in T38's `// T39` marker (early production → partial credit)
- `app/js/core/review.js`: one hook call after a correctly answered card, plus the `lr` exposure path
- `app/js/data/store.js`: `state.familiarity` default `{}`
- `test/familiarity.test.mjs` (new)
- `app/sw.js` precache + version, `app/js/version.js`
- `docs/PRD.md` new FR-R7; `docs/ARCHITECTURE.md` §4, §8; `docs/EXPERIMENTS.md` EXP-12

## Read first (only these)

- `docs/EXPERIMENTS.md` · Check-in 2026-11-04 and EXP-12
- T37's spec for `partialCredit` (`docs/tasks/T37-calibrated-spacing.md`)
- ARCHITECTURE §4.1, §8

## Goal

Math Academy's FIRe idea, applied to words. A word that appeared in a card you got right, without being the tested word, has been met again, so its own review can wait a little longer. The credit is discounted because such exposures usually come early.

## Spec

- `exposureCredit(state, sentence, testedUnits, kind, now)` → new state.
  - Every unit of `sentence` (`unitsForSentence`) that is **not** in `testedUnits`, has an `fm` card in Review state, and hasn't been credited today gets `partialCredit(card, FAMILIARITY[kind], now, { multiplier })`.
  - "Credited today" is checked against `state.familiarity[unit] === dayKey(now)`.
- `FAMILIARITY = { seen: 0.25, produced: 0.5 }`:
  - `seen`: the sentence was on screen in a correctly answered card (`lr`, `cz`, `er`, `xf`, `sb`) or a paradigm.
  - `produced`: the learner typed the word correctly but it was early (T38's marker).
- At most once per unit per local day. Claimed units are skipped (never tested anyway). Trivial lexemes are skipped.
- A wrong card gives no exposure credit.
- `partialCredit` already caps the bump at a fraction of a Medium step, so credit can never push a word past where a real review would.

## Acceptance criteria

- [ ] Tests:
  - A seen-only bump is 25 % of a Medium step and a produced-early bump is 50 %.
  - Once per day.
  - Tested, claimed and trivial units are skipped.
  - Wrong → none.
  - Never earlier.
  - A never-reviewed card is untouched.
- [ ] `node --test`, `node scripts/validate-content.mjs` and `node scripts/lint.mjs` pass. STATUS updated.
