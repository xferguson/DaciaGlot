# T26 · Learn today, test tomorrow

| | |
|---|---|
| **Phase** | 3.5 |
| **Depends on** | T25 |
| **Can run in parallel with** | T28, T30 |
| **Experiment** | [EXP-02](../EXPERIMENTS.md#exp-02--learn-today-test-tomorrow--t26) |

## Owns (files you may create or change)

- `app/js/core/session.js`, `app/js/core/mastery.js` (ignore encoding attempts)
- `app/js/ui/views/session.js`, `app/js/ui/views/card-cloze.js` (an "immediate check" variant: a muted label, no self-rating)
- `test/session.test.mjs`, `test/mastery.test.mjs`
- `app/js/version.js`, `app/sw.js` (version only)
- `docs/ARCHITECTURE.md` §4.3, §8; `docs/PRD.md` FR-S7, FR-S11, FR-S12 (**contract change**)

## Read first (only these)

- PRD §4.4 (FR-S7, S9, S11, S12), §4.8 (FR-R2)
- ARCHITECTURE §4.3, §8
- `docs/tasks/T25-per-form-schedule.md` (what `fm` cards are)
- `docs/EXPERIMENTS.md` · EXP-02

## Goal

Stop answering from working memory. A new sentence is learned, then checked once on its *new* forms only. The first counted test comes in a later session. Reviews never show two cards from the same sentence or lexeme in one session.

## Spec

- **New sentence flow:** `lr`, then (directly after) an **immediate check**: a cloze for each lexeme-form unit in the sentence that has no `fm` card yet (and, after T28, isn't claimed). A sentence with none gets `lr` only.
- **Immediate check grading:**
  - Attempts carry `enc: 1` (Attempt contract, §4.3) and are ignored by mastery and `isKnown`'s "≥1 correct".
  - The check creates the unit's `fm` card due at the **start of the next local day** or later. Correct → next day. Wrong → shown the answer, re-asked once at the end of the session (FR-S9), still due the next day.
  - No Hard/Medium/Easy rating on the check.
- **Bury siblings in reviews:** after `pickPerSentence`, keep at most one due card per sentence and per head lexeme (`cardKeys` `s:`/`l:`) in a session. The rest stay due and come up next session. The immediate check isn't affected (it belongs to the new sentence).
- `keepStarted`: if a learner leaves after the `lr` but before the check, create the missing `fm` cards due the next day (no check).
- Time estimate: a new sentence costs `SEC_PER_NEW` scaled by its number of new forms (minimum one `lr`).

## Acceptance criteria

- [ ] Tests: a new sentence with one unknown form yields `lr` + one check; with zero → `lr` only.
- [ ] Tests: `fm` cards created by a check are due ≥ next local midnight, whatever the answer.
- [ ] Tests: `enc` attempts don't count toward `produced`/`stable`/pattern state or `isKnown`.
- [ ] Tests: a review queue never holds two cards with the same `s:` or `l:` key; the buried cards are still due afterwards.
- [ ] Headless run: learn 3 sentences; no two same-sentence cards are spread apart; the next day's session tests them.
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. `docs/STATUS.md` updated. In `docs/EXPERIMENTS.md`, EXP-02 is set `live since <merge date>`.
