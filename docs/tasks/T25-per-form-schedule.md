# T25 · One schedule per word form (`fm` cards)

| | |
|---|---|
| **Phase** | 3.5 |
| **Depends on** | none |
| **Can run in parallel with** | T30 |
| **Experiment** | [EXP-01](../EXPERIMENTS.md#exp-01--one-schedule-per-word-form--t25) |

## Owns (files you may create or change)

- `app/js/core/carrier.js` (new), `test/carrier.test.mjs` (new)
- `app/js/core/cards.js`, `app/js/core/units.js`, `app/js/core/session.js`, `app/js/core/mastery.js`
- `app/js/data/migrations.js`, `app/js/data/store.js` (schema version only)
- `app/js/ui/views/session.js` (resolving `fm` → cloze or key-form presentation)
- `test/cards*.test.mjs`, `test/units.test.mjs`, `test/session.test.mjs`, `test/mastery.test.mjs`, `test/store.test.mjs`
- `app/sw.js`, `app/js/version.js`
- `docs/ARCHITECTURE.md` §3, §4, §6.1, §7.2–7.3, §8 (**contract change**: call it out at the top of the PR)
- `docs/PRD.md` FR-D2, FR-D3, FR-S3

## Read first (only these)

- PRD §4.2 (FR-D2, D3, D9), §4.4 (FR-S1–S3, S11, S12), §4.8 (FR-R1)
- ARCHITECTURE §3, §4, §6.1, §7, §8
- `docs/EXPERIMENTS.md` · Discovery interview and EXP-01

## Goal

The owner sees an already-learned form tested again because it appears in another sentence, and drilled again as a key-form card. A word form should have **one** schedule. Each time it's due, it is shown in a **different** sentence.

## Spec

- **Card id** `fm:<lexemeId>:<formKey>` (e.g. `fm:fi:pres3sg`). It's the only stored schedule for a lexeme-form unit. `cz:*` and `kf:*` ids are no longer created in `state.cards`. They are *presentations*.
- **Creation:** `cardsForSentence(sentence, content, state?)` returns `lr:<sid>` plus `fm:<lex>:<form>` for each `cloze: true` token's lexeme-form units that don't yet have an `fm` card. `newKfCards` returns `fm` ids for key forms that have no `fm` card (same unlock rule, FR-D3).
- **Presentation:** `core/carrier.js` exports `pickCarrier(unitId, state, content, {now, rng, exclude}) → {sentenceId, tokenIndex} | null`.
  - Candidates: sentences in `state.seenSentences` with a token whose units include the unit (any token, not only `cloze: true`, when it's the sole unit).
  - Skip carriers named in the unit's last 3 attempts (`attempt.card` is now the presented id, e.g. `cz:<sid>:<i>`, so attempts keep their history) and sentences in `exclude` (already used this session).
  - Prefer the fewest unknown other units (`isKnown`), then the longest since that sentence was last used, then `rng`.
  - `null` → the session shows the key-form drill for that form if it has a `keyForms` label, otherwise the least recent carrier.
- **Session:** `dueCards`, `pickPerSentence`, `cardKeys`, `inFocus` (an `fm` is in focus if any seen carrier is), `unitsRequiredForCard` and `applyReview` handle `fm`. The view resolves the carrier at render time, renders `card-cloze.js` or `card-keyform.js`, and records the attempt with `card` = the presented id. FSRS is applied to the `fm` card.
- **Migration** (schema 1 → 2, `data/migrations.js`):
  - For every `cz:*` card, map it to its token's lexeme-form unit(s). For every `kf:*`, map it to `<lex>.<form>`.
  - Group by unit and keep the CardState with the highest `stability` (ties: latest `lastReview`), with `lapses` summed. Store it as `fm:<lex>:<form>`.
  - Drop the old ids. Keep `difficult` entries by mapping them to the `fm` id. `attempts` and `unitAggregates` are unchanged.
  - Import of a v1 backup runs the same migration.
- **Mastery:**
  - §7.2 `stable` reads the unit's `fm` card.
  - §7.3: a sentence is mastered when every cloze unit's `fm` has stability ≥ 7 d and its last attempt was correct, or its `er` card has stability ≥ 7 d with the last review correct.
  - `xf`/`sb`/`er` keep their own per-sentence schedules (they test sentence building, not one form).

## Acceptance criteria

- [ ] Tests: two sentences sharing `fi.pres3sg` produce one `fm` card; a `kf` for that form doesn't create a second schedule.
- [ ] Tests: `pickCarrier` rotates (never the same carrier as the last 3 attempts when another exists), honours `exclude`, and returns `null` with no seen carrier.
- [ ] Tests: the migration folds `cz`/`kf` → `fm` (highest stability wins, lapses summed); `difficult` remaps; import of a v1 backup migrates; `load()` still never throws.
- [ ] Tests: mastery §7.2/§7.3 against `fm`; the dashboard test fixtures still pass (update fixtures through the migration).
- [ ] Headless session run: a due `fm` renders as a cloze in a seen sentence; with no carrier, as a key-form drill.
- [ ] ARCHITECTURE/PRD updated; `APP_VERSION` bumped; `sw.js` lists `core/carrier.js`.
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. `docs/STATUS.md` updated. In `docs/EXPERIMENTS.md`, set EXP-01 to `live since <merge date>`.
