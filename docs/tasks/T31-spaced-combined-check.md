# T31 · One spaced, combined immediate check; silent cloze until answered

| | |
|---|---|
| **Phase** | 3.5 |
| **Depends on** | T26 |
| **Can run in parallel with** | none (revises T26) |
| **Experiment** | [EXP-02](../EXPERIMENTS.md#exp-02--learn-today-test-tomorrow--t26) (revise, 2026-10-31) |

## Owns (files you may create or change)

- `app/js/core/session.js` (`placeChecks`, `checkBlanks`, `CHECK_GAP`; combined check items; `keepStarted`)
- `app/js/ui/views/card-cloze.js` (several blanks; no audio before answering)
- `app/js/ui/views/session.js` (`showCheck`)
- `test/session.test.mjs`
- `app/js/version.js`, `app/sw.js` (version only)
- `docs/ARCHITECTURE.md` §8, `docs/PRD.md` FR-D7, FR-S7, FR-R2, `docs/EXPERIMENTS.md` EXP-02

## Read first (only these)

- PRD §4.2 (FR-D7), §4.4 (FR-S7, S9), §4.8 (FR-R2)
- ARCHITECTURE §8
- `docs/EXPERIMENTS.md` · EXP-02 observations (2026-10-31)

## Goal

The owner learned *What will you have to eat?* and was immediately given one check for *will you have*, then another for *to eat*. With each card playing the sentence before and after answering, they heard it 6 times in a row and answered from working memory. A new sentence should get **one** check of all its new forms, **later** in the session, and a cloze shouldn't play the answer before it is typed.

## Spec

- `buildSession`: a new sentence's new `fm` cards become **one** queue item `{cardId: <first fm>, isNew: true, from, check: true, forms: [...]}`, for paradigm families too (the chosen member's forms).
- `placeChecks(queue)` replaces `glueChecks`. Each check goes at least `CHECK_GAP` (8) cards after its `lr`/paradigm card and never next to another check. If the queue is too short for that, the check goes at the end.
- `checkBlanks(sentence, forms)`: the token to blank for each form, in sentence order.
- `card-cloze.js` takes `blanks` (token indices). One input per blank; one Check; a retry re-asks only the wrong blanks. `onResult` gets `blanks: {tokenIndex, ok}[]`.
- **No autoplay on any cloze.** The sentence plays once after the answer, and the audio button appears only then.
- The view's `showCheck` applies `applyCheck` per form and re-asks only the wrong forms once at the end. `keepStarted` creates every form of an unreached check.

## Acceptance criteria

- [x] Tests: one check item per sentence lists all its new forms; `checkBlanks` finds their tokens.
- [x] Tests: `placeChecks` keeps ≥ `CHECK_GAP` cards between `lr` and check, no adjacent checks, short queues → end.
- [x] Tests: `keepStarted` creates every form of an unreached combined check.
- [x] Headless run (phone width): learn session on a fresh profile; checks come after the listen cards; a two-new-word sentence is one two-blank card; no speech before answering, one play after; audio button only after answering.
- [x] `node --test` and `node scripts/validate-content.mjs` pass. `docs/STATUS.md` updated. EXP-02 observation logged with decision `revise`.
