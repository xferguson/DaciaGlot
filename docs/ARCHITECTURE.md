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
      units.js  mastery.js  select.js  session.js (barrel)
      queue.js  due.js  spacing.js  review.js  schedule.js   # what session.js re-exports (Q11)
      time.js                # DAY_MS, dayKey, startOfDayPlus (local days)
      cards.js               # card id parsing/building, unlock rules
    data/                    # side effects live here
      content.js             # fetch + index content packs
      store.js  migrations.js
      tts.js
    ui/
      components/            # diacritic-bar.js, audio-button.js, toast.js, banner.js, topic-list.js, can-dos.js, session-summary.js …
        cards/               # card-*.js: one renderer per card type (moved from views/ in Q13)
      models/                # pure view models (dashboard, lists, lexeme, summary, card-lr, card-paradigm, hint); tests import these
      views/                 # home.js, session.js, settings.js, lists.js, dashboard.js, lexeme.js, summary.js, cando.js (import core/, data/, components/, models/, dom.js only)
  content/                   # see CONTENT_GUIDE.md
scripts/validate-content.mjs
test/*.test.mjs              # node --test; import from ../app/js/core/*
```

**Rules**

- `core/` modules must be importable in Node. They take time as a `now` parameter (ms epoch), and randomness as an injected `rng` function.
- UI modules export `render(root, ctx)` and return an optional `cleanup()`.
- `ctx = { state, content, store, tts, voices, navigate, update, updateSettings }`. Views change state only through `ctx.update(fn)` (`ctx.state = fn(ctx.state)`, one `store.save`, returns the new state; `fn` is a pure core transition) or `ctx.updateSettings(patch)`. Never assign `ctx.state` in a view.
- No framework and no bundler. All imports use relative paths ending in `.js`.

**Shared modules.** Search these before writing a helper; add to them rather than copying. "(coming in Qxx)" means not on `main` yet; the task that lands it removes the marker.

| Module | What lives there |
|---|---|
| `core/time.js` | `DAY_MS`, `dayKey(now)`, `startOfDayPlus(now, n)` |
| `core/history.js` | per-day history reads and writes |
| `core/random.js` (coming in Q06) | `shuffle` and index picks from an injected `rng` |
| `core/cards.js` | `buildCardId`/`parseCardId`: the only way to make or read a card id; `CARD_SPEC` registry |
| `core/units.js` | `unitId(u)`/`parseUnitId(id)`: the only way to make or read a unit id |
| `ui/dom.js` | safe markup helpers: `esc`, `html`, `raw`, `el` |
| `ui/components/button.js` | every button |
| `ui/components/answer-card.js` | `answerCard`, the typed-answer card controller; new card renderers build on it |

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
 * @property {Map<string, string[]>} families        familyId (smallest member id) → members (≤ 6); built by `findFamilies` (`core/families.js`)
 * @property {Map<string, string>} familyOf          sentence id → familyId
 * @property {Map<string, Set<string>>} familyForms  familyId → the `<lex>.<form>` units its members differ in
 * @property {Map<string, string[]>} familiesOfUnit  unit → familyIds it varies in
 * @property {Map<string, string[]>} similarOf       sentence id → its similar-sentence group (members, sorted, incl. itself); built by `similarGroups` (`core/similar.js`, T41); absent if it has no similar sentence
 */
```

`manifest.json` pack entries are paths relative to `baseUrl` (`"lexemes/core.json"`); each id in `levels` loads `levels/<id>.json`; `patterns.json` is always at the root. `indexContent(raw)` is the pure half: it takes `{ manifest, patterns, lexemes, sentences, levels }` (parsed JSON, packs flattened) and drops retired sentences only.

`Lexeme.transparent` and `Pattern.divergent` (optional booleans, CONTENT_GUIDE §10) drive the Romance fast-track (FR-V3): see §6.2 step 2 and `applyCheck` in §8.

The JSON shapes of `Sentence`, `Lexeme`, `Pattern` and `Level` are defined in CONTENT_GUIDE §2. They are not repeated here.

## 3. Cards

Card ids are strings. `core/cards.js` exports `parseCardId`, `buildCardId`, `cardTypeOf(id)`/`isCardType(id, type)` (non-throwing type checks; never test a prefix by hand), and `cardsForSentence(sentence, content, state?)` (→ `lr:<sid>` plus an `fm` id for each lexeme-form unit of a `cloze: true` token that has no card in `state.cards`).

| Type | Id format | Example |
|---|---|---|
| Listen & recognize | `lr:<sentenceId>` | `lr:s-a1-standup-0012` |
| Word form | `fm:<lexemeId>:<formKey>` | `fm:fi:pres3sg` |
| Cloze (presentation of `fm`) | `cz:<sentenceId>:<tokenIndex>` | `cz:s-a1-standup-0012:2` |
| Key forms (presentation of `fm`) | `kf:<lexemeId>:<formKey>` | `kf:gasi:pres3sg` |
| Transformation | `xf:<sentenceId>:<transformIndex>` | `xf:s-a1-standup-0012:0` |
| Slot-building | `sb:<sentenceId>:<transformIndex>` | `sb:s-a1-standup-0012:0` |
| EN→RO | `er:<sentenceId>` | `er:s-a1-standup-0012` |
| Paradigm group (queue only, never stored) | `pg:<familyId>` | `pg:fam-…` |

**`CARD_SPEC`** in `cards.js` holds each type's `parse`, `unlocked`, `stored` and (for drills) `drillWeight`; `parseCardId`, `isUnlocked` and `pickPerSentence` read it. **Adding a card type is one `CARD_SPEC` entry plus a renderer** in `ui/views/session.js`. Unit ids `<lex>.<form>` are made and read only by `unitId(u)`/`parseUnitId(id)` (`core/unit-id.js`, re-exported by `core/units.js`).

**One schedule per word form (T25).** `fm` is the only card stored in `state.cards` for a lexeme-form unit; `cz` and `kf` are never stored (schema ≥ 2) and exist only as ids on `attempt.card`. `core/carrier.js`:

- `carriersFor(unitId, state, content) → {sentenceId, tokenIndex}[]`: seen sentences with a token carrying the unit (`cloze: true`, or the unit is the token's only unit).
- `pickCarrier(unitId, state, content, {now, rng, exclude, recent = 3}) → {sentenceId, tokenIndex} | null`: skips sentences named in the unit's last 3 attempts and in `exclude`; a form that varies inside a family (`content.familiesOfUnit`) is carried by a family member (random among them, FR-R5); otherwise it prefers the fewest unknown other units, then the longest since the sentence was used, then `rng`.
- `pickComposite(dueEasyUnits, state, content, now, rng, {exclude, allow}) → {sentenceId, units} | null` (FR-V1): the sentence with ≥ 2 of the due easy forms among its cloze units (up to 4 kept), every other unit `isKnown`, not named by any attempt in the last 7 days, with English; most forms wins, then unseen, then `rng`.
- `resolveFm(fmId, state, content, {now, rng, exclude, prefer}) → {type: "cz", presentedId, sentenceId, tokenIndex} | {type: "kf", presentedId} | null`: a cloze carrier (`prefer` = the sentence a new `fm` came from), else the key-form drill if the lexeme's `keyForms` has the form, else the least recent carrier, else `null`.

The session view calls `resolveFm` at render time and passes the presented id to `applyReview` as the last argument.

`cards.js` also exports `isEasy(state, unit)` (FR-V1: claimed, or the `fm` card's `lastGrade` is 4, or its gap `due - lastReview` ≥ `ER_MIN_GAP_DAYS`). `CardState.lastGrade?: 1|2|3|4` is set by every review of an `fm` card (absent on old cards; no migration). `erUnlocked(sentence, state)` is true when every cloze unit is easy.

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
 * @property {number} ttsRate         // default 0.9; all defaults live in `SETTINGS_DEFAULTS` (data/store.js), never as `??` fallbacks
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
 * @property {1|2|3|4} [lastGrade]  // grade of the last counted review; read by isEasy (T32); optional
 */
```

### 4.2 Flag and DayStats

```js
/** @typedef {{sentenceId:string, note:string, ts:number}} Flag */
/** @typedef {{minutes:number, cards:number, newSentences:number, formsProduced:number, newItems:number}} DayStats */
```

The empty record and the update helpers live in `core/history.js`: `emptyDay()`, `bumpDay(history, now, fn)` (new history; `fn` gets a copy of the day), `addMinutes(state, minutes, now)` (re-exported by `session.js`).

### 4.3 Attempt and UnitAggregate

```js
/** @typedef {Object} Attempt
 * @property {string} u    // unit id: "<lexemeId>.<formKey>" or "pat:<patternId>"
 * @property {string} lx   // head lexeme id (for pattern units: the lexeme realizing it)
 * @property {0|1} c       // correct
 * @property {number} t    // ms epoch
 * @property {string} card // id the card was presented as (`cz:…`/`kf:…` for an `fm`), so rotation can see its history
 * @property {1} [enc]     // immediate check of a new form (T26, FR-R2): ignored by mastery, `isKnown`, compaction and the dashboard
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
  { result: "correct"|"correct-diacritics"|"correct-typo"|"wrong",
    diff: Array<{ token: string, status: "ok"|"wrong"|"missing"|"diacritic"|"typo" }>, // over EXPECTED tokens
    extra: string[] }                          // input tokens not aligned
// 4th arg `{ avoid?: string[] }` (T35, FR-A6): other surface forms of the same lexemes (`cards.js` `lexemeForms`).
// One edit (insert/delete/substitute/adjacent swap) in an aligned single token of ≥ 5 letters is `typo`; the whole answer is
// `correct-typo` (graded like `correct-diacritics`). A typed word that is in `avoid` is another form, not a slip → `wrong`.
tileOptions(sentence, content, rng, ro?) → string[]   // cards.js: target tokens (lowercase, no end punctuation) + 2–4 same-lexeme distractors, shuffled; `ro` overrides the target (a transform result)
lexemeForms(sentence, content) → string[]             // cards.js: every form of every lexeme in the sentence (the `avoid` list)
```

**Answer modes (T35, FR-V4).** `settings.answerMode` is `"speak"` (default) | `"tiles"` | `"type"`. `ui/components/answer-mode.js` exports `getMode`, `tapDiff(words, tapped)` (a checkAnswer-shaped diff with the tapped words `wrong`, which `erMisses` accepts), `wordsOf`, `modeSwitch`, `mountAnswer`; `tiles.js` exports `tileBuilder`. `er`/`xf`/`sb` cards take `onSetting(patch)` and `rng`. `nextButtons(actions, {canRate, onPick})` never advances by itself: **no auto-advance anywhere** (owner preference, 2026-11-01).

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

**Families (FR-R5).** `findFamilies(sentences)` (`core/families.js`, pure) groups sentences that, after dropping subject pronouns (*eu, tu, el, ea, noi, voi, ei, ele, dumneavoastră*), have the same token count and differ only in tokens that share a lexeme with another form (connected components, ≤ 6 members). `siblingsOf(sid, {state, content})` → the unseen members (wanted registers) that come with a new sentence, at most 2. `pickNewSentences` never picks a sibling as a separate sentence, so a family counts as one new sentence toward `newPerSession`.

```js
pickNewSentences(n, { focus /* {type, id} | {type, id}[] | null; focusList() normalizes */, state, content, now, rng })
  → { sentences: string[] } | { blocked: true, suggest: { type, id } }
```

1. **Candidates:** non-retired, unseen sentences whose `register` is in `settings.registers`, whose stage ≤ (the highest stage with any pattern at `seen`) + 1, and all of whose patterns have every prerequisite at ≥ `seen`. If no pattern is seen yet (cold start), only Stage 1 sentences are candidates.
2. **Novelty** = the number of units in `unitsForSentence` not known. Drop the sentence if novelty is 0 or greater than 2, **not counting fast-track units** (T34, FR-V3: lexeme-form units of a `transparent` lexeme that no `divergent` pattern slot uses; `isFastTrackUnit(unit, content)` in `select.js`; pattern units never qualify). A sentence kept only thanks to free units scores as novelty 2. (Novelty-0 sentences are not introduced as new; they may appear later as extra `cz` practice in Phase 3+.)
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

`session.js` is a barrel: import from it, the names below are unchanged. The code lives in `queue.js` (`MODES`, `buildSession` and its pipeline steps `selectDue` → `trimToBudget` (Mix) → `pickNew` → `groupNew` → `interleave` → `estimate`, plus `newDrills`; `mixPlan`, `learnPlan`), `due.js` (`dueCards`, `inFocus`, `cardKeys`, `burySiblings`, `onePerFamily`, `composeReviews`), `spacing.js` (`spaceOut`, `placeChecks`, `checkBlanks`, `requeueWrong`), `review.js` (`applyReview`, `applyErReview`, `applyParadigm`, `applyCheck`, `erMisses`, claims, `keepStarted`, `markDifficult`) and `schedule.js` (`gradeFromResult`, `scheduleCard`, `partialCredit`) and `calibrate.js` (`dailyNudge`, `calibrationSummary`, recall log). `review.js` builds every `Attempt` (§4.3) with `makeAttempts(units, correct, now, presentedId, {enc})`. New code imports the specific module. `test/session-golden.test.mjs` pins `buildSession` for every mode.

```js
buildSession({ mode /* "quick"|"review"|"learn"|"mix"|"session" */, focus /* filters every mode (FR-S8) */, state, content, now, rng, newSentenceIds })
  → { queue: QueueItem[], estimateSec: number, blocked?, suggest?, plan? /* mix only */ }
mixPlan(due, newPerSession) → { newCount, reviewPct }  // PRD FR-S10: new sentences fill MIX_BUDGET_SEC (720) after due reviews, but never fewer than MIX_MIN_NEW (3, or newPerSession if lower); buildSession then trims the review part (oldest-due stay) to fit
learnPlan(state, content, focus, now, rng) → {sentences, items} | {blocked, suggest}  // T33 / FR-V2: picks new sentences until their new-item count reaches settings.newItemsPerLearn (default 15, 5–40); a candidate costs its unknown units (≥ 1) plus the same for each paradigm sibling it brings; stops within ±1 of the target. `pickNewSentences(n, {…, items})` is the underlying option; `newItemCount(ids, state, content)` (select.js) counts a set
SEC_PER_NEW_FAST = 25  // Learn-mode estimate per new sentence incl. its check share (newSentenceSec(forms, perNew)); Mix/Session keep SEC_PER_NEW
gradeFromResult({ result, usedHint, attemptNo, rating /* "hard"|"medium"|"easy"|null */ }) → 1|2|3|4     // PRD FR-S2
applyReview(state, cardId, grade, unitsRequired /* {u,lx}[] */, now, content, presentedId = cardId) → AppState  // FSRS on `cardId` + attempts (recorded with `card: presentedId`) + history (pure; returns new state). `content` is only used for `lr` exposure. Without part-level data (`applyErReview` gets `misses` null), a wrong `er` card (grade 1) removes the claims on all units it tested (FR-R4, evidence wins). Claims reach feedback as a `claims` render option (`{content,isClaimed,claim,unclaim}`) passed by the session view; `setClaimHandler` was removed (Q15).
erMisses(sentence, diff) → {missed, ok, missedTokens} | null  // FR-D6: cloze units the EN→RO answer got wrong/right from the checkAnswer diff; null if the diff doesn't line up with the tokens
applyErReview(state, cardId, grade, unitsRequired, misses, now, content, presentedId?, composite?) → AppState  // FR-D6: `applyReview` for the `er` card, plus part-level credit: missed units get c:0 and their `fm` Again (created due now if absent; claim dropped), correct units get c:1 and keep their `fm`. `misses` null → whole card graded. A wrong `er` is not re-queued in the session. With `composite` (the unit ids a composite was built for): its correct forms get their `fm` reviewed (Good; Easy if rated Easy; Hard after a hint or retry), missed forms Again, and an unseen sentence becomes seen (no `newSentences` count). Without `misses`, grade 1 fails every composite form and any other grade passes them all.
composeReviews(ids, state, content, now, rng, focus?) → {ids, comps}  // FR-V1: replaces the due `fm` ids of easy forms by `er:<sid>` composites (greedy `pickComposite`, ≤ 4 forms each, none left with ≥ 2); `comps` maps sid → units. `buildSession` applies it after `onePerFamily` and before `burySiblings`, in review/quick/mix/session
onePerFamily(cardIds, content, rng) → string[]  // FR-R5: of the due `fm` cards whose forms vary inside one family, one at random stays; `buildSession` applies it before `burySiblings`
creditProduced(state, okUnits, grade, now) → AppState  // T38, FR-R7 (`credit.js`): each ok unit whose `fm` card is in Review state and ≥ 50 % through its gap gets `scheduleCard(card, grade, now)`; early, claimed and absent cards are left. `applyErReview` passes the correct parts not in a composite; `applyReview` passes the target units of a passed `xf`/`sb`
applyParadigm(state, item, now, content) → AppState  // FR-R5: every `item.members` sentence becomes seen (as `lr`), counted as one card; `item.deferred` `fm` cards are created due `nextDayStart(now)`
dueCards(state, content, now) → string[]      // due + unlocked card ids, most overdue first; `fm` cards of claimed forms are left out, and so is an `er` whose cloze units are all claimed until `claimCheckDue(sid, state, now)` (≥ `CLAIM_CHECK_DAYS` = 60 d since its `lastReview`, T42)
dropClaimDuplicates(items, {state, content}) → items  // T42 (`queue.js`, right after `selectDue`): if `er:<sid>` is queued and unit X is the sentence's only unclaimed cloze unit, `fm:X` is dropped from this queue
claimForm(state, unit, now) → AppState        // FR-R4: state.claimed[unit] = now (pure; creates no card)
unclaimForm(state, unit, now) → AppState      // drops the claim; the `fm` card is active again with its old schedule
dueCount(state, content, now) → number
requeueWrong(queue, pos, item, rng, content?) → {queue, at}  // PRD FR-S9: pure; a new queue with a wrong card back 3–5 cards later (with content: up to 3 more, away from related cards)
inFocus(cardId, focus, content, state?) → boolean      // FR-S8: card's sentence is in any focus topic; an `fm` is in focus if any seen carrier sentence is (needs `state`); legacy kf never; empty focus → true. `focus` is one {type,id}, a list, or null everywhere.
dueInFocus(state, content, now, focus) → string[]  // dueCards filtered by inFocus
cardKeys(item, content) → Set<string>          // "s:<sentence>" (also the `from` sentence of a new `fm`), "g:<similar group>" for the sentence or `from` sentence (T41), "l:<target lexeme>", "new" for a new lr
spaceOut(queue, content) → QueueItem[]        // PRD FR-S11; buildSession applies it to every queue
applyCheck(state, cardId, correct, unitsRequired, now, presentedId = cardId, content = null) → AppState  // FR-R2: immediate check of a new form: `enc` attempts, creates the `fm` card due `nextDayStart(now)` whatever the answer, except (T34, FR-V3, needs `content`) a right check of a fast-track form is due `FAST_TRACK_DAYS` (4) days later; no FSRS review
placeChecks(queue) → QueueItem[]              // FR-R2 (T31): each check ≥ CHECK_GAP (8) cards after its lr/paradigm, never next to another check; too short → end
checkBlanks(sentence, forms) → {cardId, tokenIndex, presentedId}[]  // T31: the tokens to blank for a combined check, in sentence order
nextDayStart(now) → number                    // start of the next local day (ms)
burySiblings(cardIds, content) → string[]     // FR-R2: at most one due card per `s:` and `l:` key (input order wins); applied to every mode's due cards
newSentenceSec(forms) → number                // time estimate of a new sentence: SEC_PER_NEW × (1 + new forms) / 2
keepStarted(state, remainingQueue, now) → AppState  // on leaving early: unreached new fm (with `from`) of an introduced sentence → new card due `nextDayStart(now)` (no check)
markDifficult(state, cardId, now) → AppState  // FR-S9: second Hard/Again in a session
scheduleCard(prev, grade, now, {multiplier=1}) → CardState   // FR-S1: first gap 2/4/10 d, then baseGap ×1.5/×3/×6, × multiplier, never shorter, ≤ 365 d; wrong → next local midnight, baseGap 0
partialCredit(prev, fraction, now, {multiplier=1}) → CardState   // FR-S13: due moves later by fraction of a Medium success, never earlier; sets lastCredit (T39/T40)
dailyNudge(calibration, target, now) → calibration   // FR-S13: once per local day, ±5 % max, multiplier 0.5–4
```

`QueueItem = { cardId, isNew: boolean, from?: string, check?: true, forms?: string[], members?: string[], deferred?: string[], composite?: true, units?: string[] }`. A **composite** (FR-V1, T32) is `{cardId: "er:<sid>", isNew: false, composite: true, units}`: `units` (2–4 unit ids) are the due easy forms it reviews; the view shows it as an `er` labelled "Review · N forms". It counts as `2 × SEC_PER_REVIEW`. A new family is one item `{cardId: "pg:<familyId>", isNew: true, members, deferred}` (a presentation only, never stored in `state.cards`; the view is `card-paradigm.js`) that replaces its members' `lr` cards; it is followed by the immediate check (`check: true`, `from` = one random member) of that member's new forms, and the other members' new forms (`deferred`) get `fm` cards due the next day without a check. `from` is the sentence a new `fm` was created with; the view shows that sentence first. `check` marks a new sentence's **one** immediate check (T26, revised by T31): `forms` lists every new `fm` of that sentence (`cardId` is the first), all blanked together in one cloze (`checkBlanks`). `buildSession` places it with `placeChecks`: at least `CHECK_GAP` (8) cards after its `lr`/paradigm card and never next to another check, or at the end of a queue too short for that. The view shows it with a muted "not scored" label and no rating, applies `applyCheck` per form, and re-asks the wrong forms once at the end of the session (an item with `isNew: false`, `check: true`, `forms` = the wrong ones). `keepStarted` creates every form of an unreached check.

- The caller gets `newSentenceIds` from `select.js` in Phase 2+, or from the FR-S4 interim order in Phase 1.
- The UI re-queues a wrong card per FR-S9 with `queue = requeueWrong(queue, …).queue` (the queue is never mutated). `tileOptions`, `pickCarrier` and `pickComposite` require `rng` (TypeError otherwise); `test/purity.test.mjs` enforces a pure `core/`.
- `units.js` `unitsRequiredForCard(cardId, content) → {u, lx}[]` feeds `unitsRequired`.

### 8.1 Pace (`core/pace.js`, T36, FR-V5)

Pure; local only, never exported as telemetry.

```js
sessionPace(attempts, exposures /* state.seenSentences */, startedAt, endedAt, content)
  → { newForms, newSentences, newPatterns: string[], minutes, perTen, reviewShare }  // new forms = distinct units of `enc` attempts in the window; new sentences = first seen in it
weeklyIntake(history, now, weeks = 8) → {label, items}[]   // sums history[day].newItems per rolling week, oldest first
nextBatchSize(current, perTen, target, checkAccuracy /* 0..1|null */, min = 5, max = 40) → number  // under target and acc ≥ .85 → ×1.25; acc < .6 → ×0.75; else unchanged; rounded, bounded
learnBatch(state) → number   // state.pace.batch when settings.adaptiveBatch (default true) else newItemsPerLearn; used by learnPlan, buildSession, Home
recordSession(state, { pace, accuracy, learn, now }) → AppState  // adds newItems to today's history; in Learn, stores the next batch in state.pace.batch and appends {t,size,perTen} (last 10) to state.pace.history
```

Settings: `paceTarget` (default 15 per 10 min, 3–60), `adaptiveBatch` (default true). State: `pace: {batch: number|null, history}`, `history[day].newItems`.

## 9. FSRS (`core/fsrs.js`)

```js
export const DEFAULT_W = [/* FSRS-5 default 19 weights */];
newCard(now) → CardState
review(card, grade, now, { w = DEFAULT_W, requestRetention = 0.9 } = {}) → CardState
retrievability(card, now) → number
```

`scheduleCard` sets `due` for every graded review (PRD FR-S1, no longer FSRS); stability and difficulty still come from FSRS and the card is left in Review state. `CardState.baseGap` (days, unscaled; 0 after a wrong answer; absent on old cards, which join at their last gap) and `lastCredit` are optional. `state.calibration = {multiplier, nudgedOn, log:[{t,gap,ok}]}` and `settings.targetRetention` (default 0.85) hold the personal multiplier. Same-day reviews use the FSRS-5 short-term stability formula. Intervals are rounded to whole days for Review state; Learning steps are 1 min and 10 min; Relearning has a single 10 min step. `fuzz: true` (with `rng`) is off by default. Tests pin outputs for fixed inputs.

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
