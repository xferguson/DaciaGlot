# T07 · Card UI: listen & recognize, cloze, diacritic bar, feedback

| | |
|---|---|
| **Phase** | 1 |
| **Depends on** | T01, T03, T06 |
| **Can run in parallel with** | T08, T09 |

## Owns (files you may create or change)

- `app/js/ui/views/card-lr.js`
- `app/js/ui/views/card-cloze.js`
- `app/js/ui/components/diacritic-bar.js`
- `app/js/ui/components/feedback.js`
- `app/js/ui/components/answer-input.js`
- `app/css/app.css` (append card styles)

## Read first (only these)

- PRD §3 (P-7, P-8), §4.2 (FR-D1, D2, D7, D8), §4.3 (FR-A2, A4, A5), §4.6 (FR-N3), §5 (NFR-3)
- ARCHITECTURE §1 (UI rules), §5

## Goal

The two Phase 1 card types, with the Memrise-style audio loop and light feedback.

## Spec

Each card view exports `renderCard(root, { card, sentence, content, tts, settings, onResult })` and calls `onResult({ result, usedHint, attemptNo, tooEasy })` once the learner is done.
- **lr:** autoplay (if on), then 4 option buttons (sentence text). Distractors per FR-D1, built by an exported pure helper `pickDistractors(sentence, content, rng)` (put it in `card-lr.js` but keep it DOM-free and test it). Correct → green and play. Wrong → mark it, reveal the right one, play.
- **cloze:** show the sentence with the target token replaced by an input sized to the token. Autoplay. **Check** button; Enter submits. Hint per FR-D8. First wrong attempt → feedback plus one retry; second wrong → reveal.
- **feedback.js:** renders the expected sentence with non-`ok` tokens highlighted (subtle underline plus tint; `diacritic` status uses the warn color), and the line "check the diacritics" for `correct-diacritics`. After a correct answer, show a small "too easy" chip (FR-S2).
- **diacritic-bar.js:** `ă â î ș ț` buttons insert at the caret of the focused input, keep focus, and insert uppercase on long-press. `answer-input.js` sets `lang="ro" autocapitalize="off" autocomplete="off" spellcheck="false"`.
- Every correct answer plays the full sentence (P-7).

## Acceptance criteria

- [ ] Keyboard-free flows work with touch emulation in DevTools at a 360 px width.
- [ ] `pickDistractors` has tests (shares-lexeme preference, fallback, never duplicates the answer).
- [ ] Wrong answers highlight exactly the tokens reported by `checkAnswer`.
- [ ] No layout shift when the on-screen keyboard opens (input stays visible).
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

Key forms, transformation, slot and EN→RO cards (Phase 2/3).
