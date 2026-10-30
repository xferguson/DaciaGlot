# DaciaGlot — Architecture & Contracts

This file defines the **interfaces between modules**, so tasks can be built in parallel by different agents. If a task needs to change a contract, it must update this file in the same PR and say so in the PR description.

---

## 1. Layout

```
app/                         # deployed site root (GitHub Pages)
  index.html                 # shell; loads js/main.js as a module
  manifest.webmanifest
  sw.js                      # service worker (must live at app root for scope)
  icons/                     # icon-192.png, icon-512.png, maskable variants
  css/app.css                # design tokens on :root + dark mode
  js/
    main.js                  # boot: load state + content, mount router
    router.js                # hash router
    version.js               # export const APP_VERSION = "x.y.z"
    core/                    # PURE: no DOM, no storage, no globals → unit-tested in Node
      normalize.js  check.js  equivalences.js
      fsrs.js
      units.js  mastery.js  select.js  session.js
      cards.js               # card id parsing/building, unlock rules
    data/                    # side effects live here
      content.js             # fetch + index content packs
      store.js  migrations.js
      tts.js
    ui/
      components/            # diacritic-bar.js, audio-button.js, toast.js, banner.js …
      views/                 # home.js, session.js, card-*.js, settings.js, lists.js, dashboard.js, lexeme.js
  content/                   # see CONTENT_GUIDE.md
scripts/validate-content.mjs
test/*.test.mjs              # node --test; import from ../app/js/core/*
```

**Rules**

- `core/` modules must be importable in Node. They take time as a `now` parameter (ms epoch), and randomness as an injected `rng` function.
- UI modules export `render(root, ctx)` and return an optional `cleanup()`.
- `ctx = { state, content, store, tts, navigate }`.
- No framework and no bundler. All imports use relative paths ending in `.js`.

## 2. Content (in memory)

`data/content.js` exports `async loadContent(baseUrl = "./content/") → Content`:

```js
/** @typedef {Object} Content
 * @property {string} contentVersion
 * @property {Map<string, Sentence>} sentences      // non-retired only
 * @property {Map<string, Lexeme>} lexemes
 * @property {Map<string, Pattern>} patterns
 * @property {Map<string, Level>} levels
 * @property {Map<string, string[]>} sentencesByPattern
 * @property {Map<string, string[]>} sentencesBySituation
 * @property {Map<string, string[]>} sentencesByLexeme
 */
```

`manifest.json` pack entries are paths relative to `baseUrl` (`"lexemes/core.json"`); each id in `levels` loads `levels/<id>.json`; `patterns.json` is always at the root. `indexContent(raw)` is the pure half: it takes `{ manifest, patterns, lexemes, sentences, levels }` (parsed JSON, packs flattened) and drops retired sentences only.

The JSON shapes of `Sentence`, `Lexeme`, `Pattern` and `Level` are defined in CONTENT_GUIDE §2. They are not repeated here.

## 3. Cards

Card ids are strings. `core/cards.js` exports `parseCardId`, `buildCardId`, and `cardsForSentence(sentence, content, state?)` (→ `lr:<sid>` plus an `fm` id for each lexeme-form unit of a `cloze: true` token that has no card in `state.cards`).

| Type | Id format | Example |
|---|---|---|
| Listen & recognize | `lr:<sentenceId>` | `lr:s-a1-standup-0012` |
| Word form | `fm:<lexemeId>:<formKey>` | `fm:fi:pres3sg` |
| Cloze (presentation of `fm`) | `cz:<sentenceId>:<tokenIndex>` | `cz:s-a1-standup-0012:2` |
| Key forms (presentation of `fm`) | `kf:<lexemeId>:<formKey>` | `kf:gasi:pres3sg` |
| Transformation | `xf:<sentenceId>:<transformIndex>` | `xf:s-a1-standup-0012:0` |
| Slot-building | `sb:<sentenceId>:<transformIndex>` | `sb:s-a1-standup-0012:0` |
| EN→RO | `er:<sentenceId>` | `er:s-a1-standup-0012` |

**One schedule per word form (T25).** `fm` is the only card stored in `state.cards` for a lexeme-form unit; `cz` and `kf` are never stored (schema ≥ 2) and exist only as ids on `attempt.card`. `core/carrier.js`:

- `carriersFor(unitId, state, content) → {sentenceId, tokenIndex}[]`: seen sentences with a token carrying the unit (`cloze: true`, or the unit is the token's only unit).
- `pickCarrier(unitId, state, content, {now, rng, exclude, recent = 3}) → {sentenceId, tokenIndex} | null`: skips sentences named in the unit's last 3 attempts and in `exclude`; prefers the fewest unknown other units, then the longest since the sentence was used, then `rng`.
- `resolveFm(fmId, state, content, {now, rng, exclude, prefer}) → {type: "cz", presentedId, sentenceId, tokenIndex} | {type: "kf", presentedId} | null`: a cloze carrier (`prefer` = the sentence a new `fm` came from), else the key-form drill if the lexeme's `keyForms` has the form, else the least recent carrier, else `null`.

The session view calls `resolveFm` at render time and passes the presented id to `applyReview` as the last argument.

**Unlock rules** live in `cards.js` as `isUnlocked(cardId, state, content) → boolean` and follow PRD FR-D1…D6.

`xf`/`sb` helpers in `cards.js`: `opInstruction(op)`, `transformPatterns(sentence, transform, content)` (the op's own pattern plus the patterns on `targetTokens`), `slotsFor(sentence, transform, content)` (→ `{type:"word",text} | {type:"slot",labels,gloss,patterns}`; `gloss` has one Leipzig label per resolved result token via `leipzigFor(lexeme, formKey)`, `[]` when none resolve so the UI falls back to `labels`), `transformUnits(sentence, transform, content) → {u, lx}[]` (used by `unitsRequiredForCard` for both types), `newTransformCards(state, content, {cap, skip})`, and `pickPerSentence(cardIds)` (FR-D9: a sentence with a due `xf`/`sb` keeps only its best `xf` > `cz` > `sb` > `er` card; an `fm` has no sentence until it is shown, so it is not thinned).

## 4. Persisted state (`localStorage["dg:v1:state"]`)

```js
/** @typedef {Object} AppState
 * @property {2} schemaVersion   // 1 → 2 (T25): `cz`/`kf` cards fold into `fm` cards
 * @property {string} contentVersion           // last content version seen
 * @property {number} createdAt
 * @property {Settings} settings
 * @property {Record<string, CardState>} cards  // only introduced cards exist here
 * @property {Record<string, number>} seenSentences   // sentenceId → first-seen ts
 * @property {Record<string, string[]>} lexemeSentences // lexemeId → distinct sentenceIds met (for kf unlock)
 * @property {Attempt[]} attempts              // last 90 days
 * @property {Record<string, UnitAggregate>} unitAggregates // folded older attempts
 * @property {Flag[]} flags
 * @property {Record<string, DayStats>} history // "YYYY-MM-DD" → stats
 * @property {Record<string, number>} canDoChecked // canDoId → ts
 * @property {number|null} lastCompactionAt
 * @property {Record<string, number>} difficult // cardId → ts: struggled with twice in one session (PRD FR-S9)
 * @property {Record<string, number>} claimed   // lexeme-form unit id (`lex.form`) → ts: "I can produce this" (PRD FR-R4, T28); default {}, no schema bump
 */


/** @typedef {Object} Settings
 * @property {number} newPerSession   // default 8
 * @property {number} ttsRate         // default 0.9
 * @property {string|null} voiceURI
 * @property {boolean} autoplay       // default true
 * @property {string[]} registers     // default ["colloquial","neutral"]
 * @property {number|null} lastExportAt
 * @property {boolean} ttsBannerDismissed
 * @property {{type: "situation"|"pattern", id: string}[]} focus // Home focus filter, several topics allowed (PRD FR-S8), default []
 */
```

### 4.1 CardState (FSRS)

```js
/** @typedef {Object} CardState
 * @property {number} due          // ms epoch
 * @property {number} stability    // days
 * @property {number} difficulty   // 1..10
 * @property {number} reps
 * @property {number} lapses
 * @property {0|1|2|3} state       // New, Learning, Review, Relearning
 * @property {number} step         // index into the learning/relearning steps (0 outside Learning/Relearning)
 * @property {number|null} lastReview
 */
```

### 4.2 Flag and DayStats

```js
/** @typedef {{sentenceId:string, note:string, ts:number}} Flag */
/** @typedef {{minutes:number, cards:number, newSentences:number, formsProduced:number}} DayStats */
```

### 4.3 Attempt and UnitAggregate

```js
/** @typedef {Object} Attempt
 * @property {string} u    // unit id: "<lexemeId>.<formKey>" or "pat:<patternId>"
 * @property {string} lx   // head lexeme id (for pattern units: the lexeme realizing it)
 * @property {0|1} c       // correct
 * @property {number} t    // ms epoch
 * @property {string} card // id the card was presented as (`cz:…`/`kf:…` for an `fm`), so rotation can see its history
 */
/** @typedef {Object} UnitAggregate
 * @property {number} n          // total attempts folded
 * @property {number} correct
 * @property {string[]} lexemes  // distinct lexemes with ≥1 correct (pattern units), capped at 50
 * @property {number} lastCorrectAt
 */
```

### 4.4 Migration 1 → 2

`migrations[1]` (content-free) renames `kf:<lex>:<form>` cards and `difficult` keys to `fm:<lex>:<form>`. `foldClozeCards(state, content)` (`data/migrations.js`; run by `main.js` after the content loads and after a backup import) folds each `cz:<sid>:<i>` card into the `fm` of every lexeme-form unit of that token: per `fm`, the CardState with the highest `stability` wins (ties: latest `lastReview`), `lapses` are summed, `difficult` is remapped, a `cz` whose sentence is gone is dropped. `attempts` and `unitAggregates` are unchanged. It is idempotent and returns the same object when no `cz` card is left.

### 4.5 Store API (`data/store.js`)

```js
load() → AppState                 // runs migrations; handles corruption per PRD NFR-6
save(state) → void                // debounced 500 ms
flush() → void                    // immediate
exportState(state) → Blob
importState(json, mode /* "merge"|"replace" */, current) → AppState  // throws ImportError
defaultState(now) → AppState
```

`store.js` reads from `globalThis.localStorage`. Tests provide an in-memory shim.

## 5. Answer checking (`core/check.js`)

```js
normalize(s) → string                         // PRD FR-A1  (normalize.js)
stripDiacritics(s) → string                   // ă→a â→a î→i ș→s ț→t (normalize.js)
tokenize(s) → string[]                        // split on whitespace; hyphenated clitic clusters stay ONE token
checkAnswer(input, expected /* string */, accept /* string[] */) →
  { result: "correct"|"correct-diacritics"|"wrong",
    diff: Array<{ token: string, status: "ok"|"wrong"|"missing"|"diacritic" }>, // over EXPECTED tokens
    extra: string[] }                          // input tokens not aligned
```

**Equivalence table** (`equivalences.js`), applied per token before comparison. Each row is a set of interchangeable spellings. A row may be one token or a two-token span:

```
n-am | nu am          n-ai | nu ai        n-a | nu a        n-au | nu au
n-are | nu are        n-o să | nu o să    nu-i | nu e | nu este
mi-e | îmi e | îmi este     ți-e | îți e | îți este     i-e | îi e | îi este
ne e | ne este        e | este
```

Diacritic-less input (*o sa*) is handled by the `correct-diacritics` path, not by this table. `nu-i` is accepted for *nu e* only. When *nu-i* means "not … him/them" (a dative clitic), the sentence lists it literally and the table isn't consulted for that token, because the token's units mark it `glue: "clitic"`.

## 6. Selection (`core/select.js`)

### 6.1 Units and "known"

`core/units.js`:

- `unitsForSentence(sentence) → string[]`: every `"<lex>.<form>"` from the token units, plus `"pat:<id>"` for each pattern.
- `isKnown(unitId, state, content) → boolean`:
  - A **lexeme-form unit** is known if it has ≥1 correct attempt (or an aggregate with `correct ≥ 1`), **or** it appears in a sentence whose `lr` card has been passed **and** its lexeme has another form already known. (Seeing a new form of a known word counts as recognition.)
  - A **pattern unit** is known when its state ≥ `seen`, i.e. ≥1 sentence containing it has been introduced.
  - A **claimed** unit (`state.claimed[unit]`, FR-R4) is always known. A claim is per form: `locui.pres3sg` ≠ `locui.pres1sg`.
  - Function words marked `"trivial": true` in the lexicon (e.g. *și, la, de*) count as known once seen.

### 6.2 Algorithm

```js
pickNewSentences(n, { focus /* {type, id} | {type, id}[] | null; focusList() normalizes */, state, content, now, rng })
  → { sentences: string[] } | { blocked: true, suggest: { type, id } }
```

1. **Candidates:** non-retired, unseen sentences whose `register` is in `settings.registers`, whose stage ≤ (the highest stage with any pattern at `seen`) + 1, and all of whose patterns have every prerequisite at ≥ `seen`. If no pattern is seen yet (cold start), only Stage 1 sentences are candidates.
2. **Novelty** = the number of units in `unitsForSentence` not known. Drop the sentence if novelty is 0 or greater than 2. (Novelty-0 sentences are not introduced as new; they may appear later as extra `cz` practice in Phase 3+.)
3. **Score:**
   - `+100` if novelty is 1, `+40` if it is 2.
   - `+50` if the sentence matches the focus.
   - Pattern focus: `+30 × (number of known lexemes among its units)`, capped at +90.
   - Situation focus: `+30` if every unknown unit is a lexeme-form unit and none is a pattern unit.
   - `+round(20 × (1 − freqRank/maxFreqRank))` using the lowest-frequency lexeme in the sentence.
   - `−15 × (number of its patterns currently at state seen and not producing)`.
4. Sort by score, descending. Among scores within 5 points of each other, shuffle with `rng`. Take `n` sentences, without picking two that introduce the same unknown unit in one call.
5. If a focus is set and fewer than `min(n, 1)` sentences match it, return `blocked`. Otherwise, with a focus, only matching sentences are picked (FR-S8). `suggest` is the unmet prerequisite pattern with the most focus sentences behind it, or else the situation with the most eligible candidates.

## 7. Mastery (`core/mastery.js`)

All functions are pure: `(state, content, now) → …`.

### 7.1 Pattern state

| State | Rule |
|---|---|
| `not-started` | No sentence with this pattern has been introduced |
| `seen` | ≥1 such sentence introduced |
| `producing` | Correct `pat:` attempts across ≥ `pattern.minLexemesForProducing` (default 5) distinct `lx`, **and** accuracy ≥ 70% over the last 20 attempts on the unit |
| `automatic` | Producing **and** ≥ 90% accuracy over the last 20 attempts **and** ≥ 10 distinct lexemes **and** ≥1 card carrying this pattern with stability ≥ 21 days |

### 7.2 Lexeme-form unit state

| State | Rule |
|---|---|
| `unseen` | Never appeared in an introduced sentence |
| `seen` | Appeared |
| `produced` | ≥1 correct attempt |
| `stable` | The unit is claimed (`state.claimed`, FR-R4; claimed cloze units also count as stable for §7.3), **or** the unit's `fm` card (or another card requiring it) has stability ≥ 21 days and the last attempt was correct |

### 7.3 Sentence mastered

A sentence is mastered when every `cloze: true` unit's `fm` card has stability ≥ 7 days and the unit's last attempt was correct, **or** the sentence's `xf` or `er` card has stability ≥ 7 days and its last review was correct. (An attempt that was folded away falls back to the card being in the Review state.)

### 7.4 Level completion

`levelProgress(levelId) → { patterns: {done, total}, canDos: {done, total}, lexemes: {done, total}, complete: boolean, percent: number }`

- **done** counts: patterns at ≥ `producing`; can-dos checked; target lexemes with ≥1 form at ≥ `produced`.
- **complete** = all required patterns done **and** can-dos ≥ 80% **and** lexemes ≥ 80%.
- **percent** = the mean of the three ratios, × 100.

## 8. Sessions (`core/session.js`)

```js
buildSession({ mode /* "quick"|"review"|"learn"|"mix"|"session" */, focus /* filters every mode (FR-S8) */, state, content, now, rng, newSentenceIds })
  → { queue: QueueItem[], estimateSec: number, blocked?, suggest?, plan? /* mix only */ }
mixPlan(due, newPerSession) → { newCount, reviewPct }  // PRD FR-S10: new sentences fill MIX_BUDGET_SEC (720) after due reviews
gradeFromResult({ result, usedHint, attemptNo, rating /* "hard"|"medium"|"easy"|null */ }) → 1|2|3|4     // PRD FR-S2
applyReview(state, cardId, grade, unitsRequired /* {u,lx}[] */, now, content, presentedId = cardId) → AppState  // FSRS on `cardId` + attempts (recorded with `card: presentedId`) + history (pure; returns new state). `content` is only used for `lr` exposure. A wrong `er` card (grade 1) also removes the claims on the units it tested (FR-R4, evidence wins).
dueCards(state, content, now) → string[]      // due + unlocked card ids, most overdue first; `fm` cards of claimed forms are left out
claimForm(state, unit, now) → AppState        // FR-R4: state.claimed[unit] = now (pure; creates no card)
unclaimForm(state, unit, now) → AppState      // drops the claim; the `fm` card is active again with its old schedule
dueCount(state, content, now) → number
requeueWrong(queue, pos, item, rng, content?) → number  // PRD FR-S9: splice a wrong card back 3–5 cards later (with content: up to 3 more, away from related cards)
inFocus(cardId, focus, content, state?) → boolean      // FR-S8: card's sentence is in any focus topic; an `fm` is in focus if any seen carrier sentence is (needs `state`); legacy kf never; empty focus → true. `focus` is one {type,id}, a list, or null everywhere.
dueInFocus(state, content, now, focus) → string[]  // dueCards filtered by inFocus
cardKeys(item, content) → Set<string>          // "s:<sentence>" (also the `from` sentence of a new `fm`), "l:<target lexeme>", "new" for a new lr
spaceOut(queue, content) → QueueItem[]        // PRD FR-S11; buildSession applies it to every queue
keepStarted(state, remainingQueue, now) → AppState  // on leaving early: unreached new fm (with `from`) of an introduced sentence → new card due now
markDifficult(state, cardId, now) → AppState  // FR-S9: second Hard/Again in a session
ladderDays(prevGapDays, grade) → number       // FR-S1: Medium 1→4→16→64→256 d; Easy ×3, capped at 256
```

`QueueItem = { cardId, isNew: boolean, from?: string }`. `from` is the sentence a new `fm` was created with; the view shows that sentence first.

- The caller gets `newSentenceIds` from `select.js` in Phase 2+, or from the FR-S4 interim order in Phase 1.
- The UI re-queues a wrong card per FR-S9 by splicing the queue (`requeueWrong`).
- `units.js` `unitsRequiredForCard(cardId, content) → {u, lx}[]` feeds `unitsRequired`.

## 9. FSRS (`core/fsrs.js`)

```js
export const DEFAULT_W = [/* FSRS-5 default 19 weights */];
newCard(now) → CardState
review(card, grade, now, { w = DEFAULT_W, requestRetention = 0.9 } = {}) → CardState
retrievability(card, now) → number
```

`session.applyReview` overrides `due` for Good/Easy with `ladderDays(prevGapDays, grade)` (PRD FR-S1); stability, difficulty and state still come from FSRS. Same-day reviews use the FSRS-5 short-term stability formula. Intervals are rounded to whole days for Review state; Learning steps are 1 min and 10 min; Relearning has a single 10 min step. `fuzz: true` (with `rng`) is off by default. Tests pin outputs for fixed inputs.

## 10. TTS (`data/tts.js`)

```js
init() → Promise<{ available: boolean, voices: SpeechSynthesisVoice[] }>  // waits for voiceschanged (max 2 s)
speak(text, { rate }) → Promise<void>   // cancels any current utterance first
pickVoice(voices, savedURI) → SpeechSynthesisVoice|null
```

## 11. Versioning and service worker

- `APP_VERSION` lives in `js/version.js`. Bump it on any shell change.
- The cache name is `dg-${APP_VERSION}-${contentVersion}`.
- `sw.js` precaches the shell list (a hard-coded array in `sw.js`, kept current by the task that adds files; the validator checks that every file under `app/js` and `app/css` is listed). Content JSON is cached on first fetch.
