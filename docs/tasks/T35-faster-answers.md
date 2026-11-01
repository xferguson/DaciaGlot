# T35 · Faster answers: speak and self-grade, word tiles, lenient typing

| | |
|---|---|
| **Phase** | 3.6 |
| **Depends on** | none (uses T27's `erMisses`) |
| **Can run in parallel with** | T32, T33, T34, T36 (UI files; coordinate on `session.js` view if T32 is open) |
| **Experiment** | [EXP-09](../EXPERIMENTS.md#exp-09--faster-answers--t35) |

## Owns (files you may create or change)

- `app/js/ui/components/answer-mode.js` (new: mode switch), `app/js/ui/components/tiles.js` (new)
- `app/js/ui/views/card-enro.js`, `card-transform.js`, `card-slot.js` (speak/tiles/type), `card-cloze.js` (lenient + auto-advance only)
- `app/js/ui/components/feedback.js` (auto-advance; claim stays reachable)
- `app/js/core/check.js` (typo tolerance), `app/js/core/cards.js` (`tileOptions`)
- `app/js/ui/views/settings.js`, `app/js/data/store.js` (`answerMode`, `autoAdvance` defaults)
- `app/css/app.css` (tiles), `app/sw.js` precache + version, `app/js/version.js`
- `test/check.test.mjs`, `test/cards.test.mjs`
- `docs/ARCHITECTURE.md` §5; `docs/PRD.md` FR-A*, FR-D4–D6, new FR-V4; `docs/EXPERIMENTS.md` EXP-09 status

## Read first (only these)

- `docs/EXPERIMENTS.md` · Check-in 2026-11-01 and EXP-09
- PRD §4.2, §4.3, §4.9
- ARCHITECTURE §5, §8 (`erMisses`)

## Goal

Typing is the slowest step, mostly on a phone. Let production cards be answered faster without becoming recognition.

## Spec

- `settings.answerMode`: `speak` (default) | `tiles` | `type`. A small switch on each `er`/`xf`/`sb` card changes it for that card and remembers it. Cloze stays typed (short).
- **Speak:** show the prompt → "Say it, then reveal" → reveal shows the Romanian, plays it, and every token is tappable. Tap the words you got wrong, then "Done" (or "All right" if none). Build a diff from the taps and grade through `erMisses`/`applyErReview` (part-level). Ratings as now.
- **Tiles:** `tileOptions(sentence, content, rng)` = the target tokens plus 2–4 distractor forms of the same lexemes (other person/number/definiteness), shuffled. Tapping builds the answer; check as typed.
- **Type (lenient):** `checkAnswer` treats one edit (insert/delete/substitute/transpose) in a token of ≥ 5 letters as `correct-typo` (shown with the fix, graded like `correct-diacritics`). Not for short tokens or for clitics/endings that change the form (the edit must not produce another form of the same lexeme).
- **Auto-advance:** with `autoAdvance` on (default), a fully correct answer plays the sentence and moves on after it ends. Wrong or partly wrong answers wait. The "I can produce this" claim remains reachable from the session summary's word list (or a long-press on a token before it advances).

## Acceptance criteria

- [ ] Tests: typo tolerance accepts *locuiest* → *locuiește*-style slips on long words, rejects an edit that yields another form of the lexeme, ignores short tokens.
- [ ] Tests: `tileOptions` includes every target token and only same-lexeme distractors.
- [ ] Tests: a speak-mode tap diff feeds `erMisses` and reschedules only the tapped units.
- [ ] Headless run (phone width, light + dark): each mode on an `er` card; auto-advance on correct; 44 px tiles.
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
