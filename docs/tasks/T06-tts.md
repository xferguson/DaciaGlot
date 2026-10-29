# T06 · Text-to-speech wrapper

| | |
|---|---|
| **Phase** | 1 |
| **Depends on** | none |
| **Can run in parallel with** | T01, T02, T03, T04, T05 |

## Owns (files you may create or change)

- `app/js/data/tts.js`
- `app/js/ui/components/audio-button.js`
- `test/tts.test.mjs`

## Read first (only these)

- PRD §2 (C-5), §4.7 (FR-X6), §8 (Android TTS setup)
- ARCHITECTURE §10

## Goal

Reliable Romanian speech from the Web Speech API, with graceful fallback.

## Spec

- `init()` resolves after `voiceschanged` or 2 s. `pickVoice` prefers the saved `voiceURI`, then `lang` `ro-RO`, then any `ro*`; returns null if none.
- `speak()` cancels any current utterance, sets `lang = "ro-RO"`, voice, and rate; resolves on `end` or `error` (never hangs: 15 s safety timeout). Works around Chromium's long-utterance pause bug by not exceeding about 200 characters (split at punctuation).
- `audio-button.js`: `audioButton({text, rateNormal, rateSlow})` returns a button. Tap → normal rate, long-press (≥450 ms) → slow (0.7). Shows a playing state.
- When no voice is available, export `noVoiceHelp` (the text from PRD §8) for the banner.
- Test `pickVoice` in Node with fake voice objects.

## Acceptance criteria

- [ ] `pickVoice` unit tests pass for: saved URI present/missing, ro-RO, ro-MD, none.
- [ ] Manual check on desktop Chromium: speaks *Bună dimineața, ce mai faci?* with a Romanian voice if one is installed.
- [ ] PR notes whether Brave on Android exposes a Romanian voice (if the author can test; otherwise flag it for T10's device QA).
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

Audio packs (Phase 4).
