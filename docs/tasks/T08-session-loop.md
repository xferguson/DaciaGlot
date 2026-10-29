# T08 · Session engine and session view (Quick / Session)

| | |
|---|---|
| **Phase** | 1 |
| **Depends on** | T02, T04, T05 |
| **Can run in parallel with** | T07, T09 |

## Owns (files you may create or change)

- `app/js/core/session.js`
- `app/js/core/cards.js`
- `app/js/core/units.js`
- `app/js/ui/views/session.js`
- `app/js/ui/views/settings.js`
- `app/js/main.js` (wire real state/content)
- `test/session.test.mjs`
- `test/cards.test.mjs`
- `test/units.test.mjs`

## Read first (only these)

- PRD §4.4 (FR-S2, S3, S4, S6, S7, S9), §4.6 (FR-N5), §4.7 (FR-X1, X3, X4)
- ARCHITECTURE §3, §4, §6.1, §8

## Goal

Tie everything into a working study loop with persistence. This task makes the app usable.

## Spec

- `cards.js`: id helpers; `cardsForSentence` (Phase 1 creates only `lr` and `cz`); `isUnlocked` for `lr`/`cz` (later types return false until Phase 2 tasks extend it).
- `units.js`: `unitsForSentence`, `unitsRequiredForCard(cardId, content)` (for `cz`: the target token's units + `pat:` for patterns those units realize), `isKnown` per ARCHITECTURE §6.1.
- `session.js`: `buildSession` (Quick: due by overdueness, cap 15; Session: due + new interleaved per FR-S7, with the FR-S4 interim order for picking new sentences when `newSentenceIds` isn't passed); `gradeFromResult`; `applyReview` (FSRS update + attempts per FR-S3 + `lr` exposure updating `seenSentences`/`lexemeSentences` + `history` day stats).
- `views/session.js`: reads `mode` from the hash; renders cards (from T07) one after another; handles re-queue (FR-S9) and the 5-min cap for Quick; saves after each card; shows a minimal end screen (counts) and goes Home.
- `settings.js`: new per session, TTS voice picker + rate, autoplay, **Export**, **Import** (merge/replace dialog), **Reset** (type "RESET").
- `main.js`: `store.load()`, `loadContent()`, `tts.init()`; show banners for no-voice, recovered-state and quota errors; `navigator.storage.persist()` on first run; flush on `visibilitychange`.
- If T07 isn't merged yet, render a minimal text-only card stub behind the same `renderCard` interface and replace it when T07 lands.

## Acceptance criteria

- [ ] Tests: grade inference table; Quick ordering and cap; Session interleave (no adjacent new); attempts recorded for `cz` but not `lr`; `isKnown` cases.
- [ ] Manual: complete a Session on desktop; reload → due counts persist; export → reset → import → identical due counts.
- [ ] Home shows the real due count.
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

i+1 selection (T12), Focus mode (T13).
