# Task board

Statuses: `todo` · `in-progress` · `review` · `done` · `blocked`. Update your row in your PR. Pick the lowest-numbered `todo` whose dependencies are `done`.

| Task | Title | Phase | Depends on | Status | Branch / PR | Notes |
|---|---|---|---|---|---|---|
| [T01](tasks/T01-app-shell.md) | App shell, router, design tokens | 1 | none | done | ccr-59c9c6c2-h0ddc5 | Router takes `routes` of `() => import()` loaders; unbuilt views (session, lists, dashboard, lexeme) are placeholders in `main.js` to replace. Toasts/banners mount into `#toasts`/`#banners` in index.html. |
| [T02](tasks/T02-content-schema-validator.md) | Content loader, validator, seed content | 1 | none | todo | | |
| [T03](tasks/T03-answer-checking.md) | Answer checking: normalize, equivalences, diff | 1 | none | done | ccr-1c0d311d-qepdz7 | API in ARCHITECTURE §5 implemented; also exports tokenKey (normalize.js) and canonicalize/EQUIVALENCE_SETS (equivalences.js). Pairs aligned as "wrong" are not in `extra`. |
| [T04](tasks/T04-fsrs.md) | FSRS-5 scheduler | 1 | none | todo | | |
| [T05](tasks/T05-store.md) | Persistence: store, migrations, export/import | 1 | none | todo | | |
| [T06](tasks/T06-tts.md) | Text-to-speech wrapper | 1 | none | done | ccr-d5a849d3-rlouxk | `init({voiceURI})` also accepts the saved URI (plus `setVoiceURI`); exports `noVoiceHelp`, `splitText`, `DEFAULT_RATE`. `audioButton` styles inline (no app.css change). No `sw.js` yet, so T10 must precache `data/tts.js` and `ui/components/audio-button.js`. **Open for T10 device QA:** TTS never manually verified. Check that *Bună dimineața, ce mai faci?* is spoken by a ro-RO voice on desktop Chromium and on Brave/Android, note whether Brave exposes a Romanian voice, and confirm the long-press slow rate and no-voice banner (`noVoiceHelp`) behave. |
| [T07](tasks/T07-card-ui.md) | Card UI: listen & recognize, cloze, diacritic bar, feedback | 1 | T01, T03, T06 | todo | | |
| [T08](tasks/T08-session-loop.md) | Session engine and session view (Quick / Session) | 1 | T02, T04, T05 | todo | | |
| [T09](tasks/T09-content-batch-a.md) | Content batch A: Stage 1, ~100 sentences | 1 | T02 | todo | | |
| [T10](tasks/T10-pwa-offline.md) | PWA: manifest, service worker, update flow, device QA | 1 | T01, T07, T08 | todo | | |
| [T11](tasks/T11-mastery.md) | Mastery derivation and attempt compaction | 2 | T08 | todo | | |
| [T12](tasks/T12-selection.md) | i+1 selection engine | 2 | T08, T11 | todo | | |
| [T13](tasks/T13-lists-focus-ui.md) | Situations / Patterns lists, Focus mode, lexeme detail | 2 | T11, T12 | todo | | |
| [T14](tasks/T14-key-forms.md) | Key-forms cards and unlock chain | 2 | T08 | todo | | |
| [T15](tasks/T15-transform-slot.md) | Transformation and slot-building cards | 2 | T08, T11 | todo | | |
| [T16](tasks/T16-flagging.md) | Flag a sentence → GitHub issue | 2 | T07 | todo | | |
| [T17](tasks/T17-content-batch-b.md) | Content batch B: to ~300 sentences, all situations | 2 | T09 | todo | | |
| [T18](tasks/T18-dashboard.md) | Progress dashboard | 3 | T11, T19 | todo | | |
| [T19](tasks/T19-levels-cando.md) | A1 level manifest and can-do tracking | 3 | T11 | todo | | |
| [T20](tasks/T20-en-ro-cards.md) | EN→RO cards | 3 | T08, T15 | todo | | |
| [T21](tasks/T21-summary-reminders.md) | Session summary and export reminder | 3 | T11 | todo | | |
| [T22](tasks/T22-coverage-report.md) | Content coverage report in CI | 3 | T02 | todo | | |
| [T23](tasks/T23-content-batch-c.md) | Content batch C: Stages 1–2 complete (400–600) | 3 | T17, T19, T22 | todo | | |

## Epics not yet broken into tasks

- **E4 · A2 pack (Phase 4):** Stage 3–4 patterns + `requires` edges, A2 manifest and can-dos, formal register (`register-formal`, PRD Q1), optional audio packs (PRD Q3). Write the tasks when Phase 3 is done.
- **E5 · Reading & personal (Phase 5):** reading mode with tap-to-gloss (lemma + form + unit state) feeding `lexemeSentences`/known units; user-added sentences with local tokenization assistance.

## Parallelism map

```
Phase 1:  T01 T02 T03 T04 T05 T06   (all independent)
            │   │   │   │   │   │
            │   ├── T09 (content)    │
            ├───────T07 ◄────────────┘ (needs T01,T03,T06)
            │   └─┬─T08 ◄─ T04,T05
            └─────┴─T10 (needs T01,T07,T08)
Phase 2:  T11 ← T08 · T12 ← T08,T11 · T13 ← T11,T12 · T14 ← T08 · T15 ← T08,T11 · T16 ← T07 · T17 ← T09
Phase 3:  T19 ← T11 · T18 ← T11,T19 · T20 ← T08,T15 · T21 ← T11 · T22 ← T02 · T23 ← T17,T19,T22
```
