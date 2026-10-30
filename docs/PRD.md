# DaciaGlot — Product Requirements Document

**Status:** Approved for build · **Version:** 1.0 · **Owner:** Alexander Ferguson
**Source of truth.** Where this document disagrees with `docs/archive/PLAN-v0.md`, this document wins.

**How to use this PRD.** The work is split into self-contained tasks in [`docs/tasks/`](tasks/), so separate agent sessions can build it without sharing context. Agents start at [`CLAUDE.md`](../CLAUDE.md), pick a task from [`docs/STATUS.md`](STATUS.md), and read only:

- the PRD sections the task cites
- [`docs/ARCHITECTURE.md`](ARCHITECTURE.md), which defines module contracts and data types
- [`docs/CONTENT_GUIDE.md`](CONTENT_GUIDE.md), for content tasks

---

## 1. Problem and goal

**User.** One learner: an experienced polyglot with a linguistics background.

- **Languages:** French C1, Spanish B1, Italian B1, Portuguese A2, Mandarin, Turkish B1.
- **Romanian now:** reads with help, hears it accurately, but **cannot produce it**.
- **Situation:** manages a software team in a Romanian office, and has Romanian friends.

**Problem.** The bottleneck is **recalling the right form of a word while building a sentence**: verb forms by person and class, noun plural/definite/oblique forms, and the clitic/auxiliary "glue" such as *nu i-am găsit*. The learner already knows the rules. What's missing is enough examples across words they already know for the patterns to become automatic. Topic-ordered textbooks and rigid apps scattered the forms and never trained production.

**Goal (6 months).** Run parts of meetings in Romanian. Hold dinner or bar conversation with the team, including talking around missing words.

**Product.** An offline-first, phone-first PWA with no backend. It does sentence-based spaced repetition, where each new sentence adds exactly one new thing, with production drills and audio. Progress is measured by **what the learner can produce**, organized by CEFR level.

**Non-goals (v1)**

- Pronunciation scoring or voice recording.
- Accounts, sync, or any server.
- iOS-specific support.
- Gamification streaks.
- A grammar textbook.

## 2. Users, devices and constraints

| ID | Constraint |
|---|---|
| C-1 | Primary device: **Android phone, Brave browser**. Secondary: desktop Chromium for development. |
| C-2 | **No backend.** All persistence is in `localStorage` on the device. The app is a static site on GitHub Pages at `https://xferguson.github.io/DaciaGlot/`. |
| C-3 | **Works fully offline** after the first load, and is installable to the home screen. |
| C-4 | **No build step, no runtime dependencies:** vanilla ES modules, HTML, CSS. Dev tooling is Node ≥ 22 built-ins only (`node --test`). |
| C-5 | Audio comes from the Web Speech API `speechSynthesis` with a `ro-RO` voice. Pre-recorded audio packs are a later, optional enhancement. |
| C-6 | Sessions are **5 min (Quick)** or **20–40 min (Session)**. One-handed phone use. |

## 3. Design principles (normative)

| ID | Principle |
|---|---|
| P-1 | **Sentences, not lists.** Every studied item appears inside a sentence. The only exception is key-forms cards, which unlock after the word has been met in sentences. |
| P-2 | **i+1.** A new sentence has exactly one unknown unit where possible, and never more than two. |
| P-3 | **Phrase first, then parts.** A lexeme is met in sentences, then gets key-forms cards, then appears in transformations. |
| P-4 | **Type frequency.** Patterns are practiced across many different known lexemes. Mastery requires breadth across lexemes, not repetitions of one example. |
| P-5 | **Processability order.** Word-internal morphology comes before morphology that needs agreement across a phrase. The stage sequence in §6 encodes this. |
| P-6 | **Production is the measure.** Headline metrics count patterns and forms *produced*. "Words known" is never shown alone. |
| P-7 | **Audio is the reward.** After every correct answer the sentence plays so the learner can shadow it. |
| P-8 | **Light feedback.** Show the correct sentence, play it, and subtly highlight the wrong token(s). No grammar explanations. |
| P-9 | **Freedom with guidance.** The learner can enter by Situation or by Pattern. Either way, the app fills it with what the learner already knows from the other axis. |
| P-10 | **Local-first and portable.** Explicit export/import. Never lose progress silently. |

## 4. Functional requirements

Requirement IDs are referenced by tasks and tests.

### 4.1 Content and curriculum

| ID | Requirement | Phase |
|---|---|---|
| FR-C1 | Content is static JSON in `app/content/`, split into packs listed in `manifest.json`, following the schemas in CONTENT_GUIDE §2. | 1 |
| FR-C2 | Every sentence is tagged with `level`, `stage`, `situations[]`, `patterns[]`, `register`, and tokens whose `units[]` reference lexeme forms. | 1 |
| FR-C3 | IDs (sentence, lexeme, pattern, can-do) are **stable forever**. Removing an item requires a `retired: true` flag instead of deletion. | 1 |
| FR-C4 | `scripts/validate-content.mjs` enforces the integrity rules in CONTENT_GUIDE §4, exits non-zero on error, and runs in CI. | 1 |
| FR-C5 | The validator prints a **coverage report**: sentences per pattern, situation and can-do, plus lexeme exposure and gaps below thresholds. | 3 |
| FR-C6 | Situations (ids): `standup`, `decisions`, `coaching`, `domain`, `table`, `me`, `getting-to-know`, `news`, `meta`. Definitions are in CONTENT_GUIDE §5. | 1 |
| FR-C7 | Register: `tu` by default. Each sentence has `register ∈ {colloquial, neutral, formal, written}`. `formal` (*dumneavoastră*) content starts at Stage 4. | 1 / 4 |
| FR-C8 | Content volume targets: **Phase 1: ≥100** sentences (Stage 1). **Phase 2: ≥300** (Stage 1 complete, Stage 2 started, all 9 situations ≥10 each). **Phase 3: 400–600** (Stages 1–2 = A1). | 1–3 |

### 4.2 Cards and drills

| ID | Requirement | Phase |
|---|---|---|
| FR-D1 | **Listen & recognize** (`lr`): play a sentence, then the learner picks the matching text from 4 options. The 3 distractors come from other sentences sharing ≥1 lexeme or pattern; fall back to the same situation. It is the first card for every new sentence. | 1 |
| FR-D2 | **Cloze** (`cz`): audio plays and the sentence is shown with one token blanked, and the learner types the token. Only tokens with `cloze: true` can be blanked. There is one card per cloze token. | 1 |
| FR-D3 | **Key forms** (`kf`): shows the lemma, gloss and requested form label (e.g. *găsi · eu, prezent*). The learner types the form. There is one card per `keyForms` entry. It unlocks when the lexeme has been met in ≥2 distinct sentences. | 2 |
| FR-D4 | **Transformation** (`xf`): shows a source sentence and an instruction from the fixed op vocabulary (CONTENT_GUIDE §3). The learner types the whole result. It unlocks when every lexeme in the sentence has had its key-forms cards introduced and the op's pattern prerequisites are at Seen or above. | 2 |
| FR-D5 | **Slot-building** (`sb`): shows the slots (e.g. `[nu] + [them] + [past] + găsi`), derived from a transform's target units. The learner types the sentence. It unlocks when the op's pattern is at Seen or above. | 2 |
| FR-D6 | **EN→RO** (`er`): shows the English. The learner types the Romanian. It unlocks when all cloze cards for the sentence have stability ≥ 7 days. | 3 |
| FR-D7 | **Audio loop.** `lr`, `cz` and `er`-on-reveal play the sentence on present (if autoplay is on). Every card plays its full target sentence after a correct answer. A wrong answer shows the correct sentence and plays it. Replay is always available. Long-press replay plays it at 0.7×. | 1 |
| FR-D8 | **Hint.** One tap reveals the first letter of each expected token that is still wrong. Using a hint caps the grade at *Hard*. | 1 |
| FR-D9 | Drill weighting when choosing among due-and-unlocked card types for the same sentence: `xf` > `cz` > `sb` > `er` (learner preference). | 2 |

### 4.3 Answer checking

| ID | Requirement | Phase |
|---|---|---|
| FR-A1 | Normalize before comparing: NFC, lowercase, trim and collapse whitespace, strip final punctuation and quotes, map cedilla `ş ţ Ş Ţ` → comma-below `ș ț Ș Ț`, and map hyphen variants (`‑ – —`) → `-`. | 1 |
| FR-A2 | Results: an exact match to the expected answer or any `accept[]` entry → `correct`. A match after stripping diacritics → `correct-diacritics`, which grades the same as correct but shows the note "check the diacritics" and highlights those characters. Anything else → `wrong`. | 1 |
| FR-A3 | **Contraction equivalence** at token level, from a fixed table (ARCHITECTURE §5): e.g. *n-am* ≡ *nu am*, *mi-e* ≡ *îmi e* ≡ *îmi este*. The table is the only source of extra variants beyond `accept[]`. | 1 |
| FR-A4 | Wrong answers get a token-level diff (LCS over normalized tokens) marking each expected token `ok \| wrong \| missing` and each input token `extra`. The UI highlights only the non-`ok` tokens of the *expected* sentence. | 1 |
| FR-A5 | A **diacritic bar** (`ă â î ș ț`) above the input inserts at the cursor. Long-press inserts the uppercase letter. | 1 |

### 4.4 Scheduling, selection, sessions

| ID | Requirement | Phase |
|---|---|---|
| FR-S1 | **FSRS-5** with default weights, implemented in-repo (`core/fsrs.js`), with deterministic unit tests. Target retention is 0.9. | 1 |
| FR-S2 | **Grades are inferred:** correct first try → Good (3). `correct-diacritics` → Good (3). Correct after hint or second try → Hard (2). Wrong → Again (1). After a correct first try with no hint, the learner rates it and moves on in one tap: **Hard** → Hard (2), **Medium** → Good (3, the default, focused), **Easy** → Easy (4). Otherwise a single Continue. | 1 |
| FR-S3 | Every graded production card (`cz`, `kf`, `xf`, `sb`, `er`) appends an **attempt** for each unit it required (ARCHITECTURE §4.3). `lr` records *exposure*, not attempts. | 1 |
| FR-S4 | **Interim new-sentence order (Phase 1 only):** unseen, non-retired sentences ordered by `stage` ↑, then the minimum unknown-unit count ↑, then `id`. FR-S5 replaces it. | 1 |
| FR-S5 | **i+1 selection** (`core/select.js`), exactly per ARCHITECTURE §6: candidate filter → novelty → score with cross-prioritization → pick with seeded tie-break randomness. It never returns a sentence with novelty > 2. If none are eligible for the focus, it returns `{ blocked: true, suggest: <patternId or situationId> }`. | 2 |
| FR-S6 | **Quick mode:** only due cards, most overdue first. It stops at 15 cards or 5 minutes, whichever comes first. | 1 |
| FR-S7 | **Session mode:** due cards plus N new sentences (`settings.newPerSession`, default 8), each new sentence introduced as `lr` then `cz`, interleaved so no two new sentences are adjacent. The time estimate is shown before starting (≈ 12 s per review, 40 s per new sentence). | 1 |
| FR-S10 | **Learn, Review and Mix modes** (home screen, alongside Quick). **Learn:** new material only, with no due cards: `newPerSession` new sentences plus newly unlocked drills. **Review:** every due card, uncapped, nothing new. **Mix** (the default; old `mode=session` links open it): all due cards plus as many new sentences as fit a ≈12-minute budget after reviews (12 s each), at most `newPerSession`, 0 once reviews fill it (`mixPlan`). The preview shows the review/new split and why. | 3 |
| FR-S11 | **Spacing within a session:** cards that share a sentence or a target lexeme are kept at least 2 cards apart where the next 8 cards allow it (`spaceOut`); a sentence's cards keep their order (`lr` before `cz`), and a re-queued wrong card avoids landing next to a related card. | 3 |
| FR-S12 | **Exit and resume:** the session screen has an × (Exit) button. The remaining queue is saved after every answer (`AppState.activeSession`), so reopening the same mode within 12 h continues where it stopped, and Home shows a "Continue" card. Leaving counts the minutes studied. | 3 |
| FR-S8 | **Focus mode:** Session mode restricted to one situation or pattern, applied both to new selection and to the order of due cards (focus first). | 2 |
| FR-S9 | A card answered wrong is re-queued once, 3–5 cards later in the same session. | 1 |

### 4.5 Progress and measurement

| ID | Requirement | Phase |
|---|---|---|
| FR-P1 | **Pattern states** are derived from the attempts and aggregates per ARCHITECTURE §7: `not-started → seen → producing → automatic`. | 2 |
| FR-P2 | **Lexeme-form unit states:** `unseen → seen → produced → stable`, also per ARCHITECTURE §7. | 2 |
| FR-P3 | **Level manifests** (`content/levels/A1.json`, …) list required patterns, can-dos and target lexemes. Completion is per ARCHITECTURE §7.4. | 3 |
| FR-P4 | **Can-do statements** are shown per situation. A can-do is *checkable* when all its linked sentences are mastered (ARCHITECTURE §7.3). Checking is a learner action, stored with a timestamp. | 3 |
| FR-P5 | **Dashboard, in priority order:** level rings; patterns grid by stage and state; can-do checklist; production stats (distinct forms produced, all time and this week; sentences mastered; words known shown *beside* those); a weekly history chart (forms produced, minutes); a 14-day review forecast. | 3 |
| FR-P6 | **Session summary:** cards done, new sentences, pattern state changes, and forms produced in this session. | 3 |
| FR-P7 | No streak counter on Home. "Days studied this month" is shown in History only. | 3 |

### 4.6 Navigation and screens

| ID | Requirement | Phase |
|---|---|---|
| FR-N1 | **Home:** due count, **Quick** and **Session** buttons, the current level ring (placeholder until Phase 3), and Situations/Patterns tabs (Phase 2). | 1 / 2 |
| FR-N2 | **Situations / Patterns lists:** each row shows its state or mastery bar and the count of i+1-eligible sentences. Tapping a row starts a Focus session. | 2 |
| FR-N3 | **Card screen:** prompt, input + diacritic bar, Check, Hint, replay, flag, and a session progress bar. | 1 |
| FR-N4 | **Lexeme detail** (tap a word on a reviewed card): key forms, known sentences containing it, unit states. | 2 |
| FR-N5 | **Settings:** new per session, TTS voice + rate, autoplay, register filter, export/import, flagged sentences, reset (with typed confirmation). | 1 / 2 |
| FR-N6 | Hash-based router (`#/home`, `#/session`, `#/settings`, …) so deep links work on GitHub Pages. | 1 |

### 4.7 Persistence, audio, offline, feedback loop

| ID | Requirement | Phase |
|---|---|---|
| FR-X1 | State is kept in a single `localStorage` key, `dg:v1:state`, following ARCHITECTURE §4. Saves are debounced at 500 ms, and also flushed on `visibilitychange`→hidden. Every write is wrapped in try/catch; on a quota error, show a banner urging export. | 1 |
| FR-X2 | Schema migrations live in `data/migrations.js`, keyed by `schemaVersion`. Loading runs every pending migration in order. | 1 |
| FR-X3 | **Export** downloads `daciaglot-backup-YYYY-MM-DD.json`. **Import** validates the shape and offers **Merge** (per card, keep the later `lastReview`; union the attempts, deduplicated) or **Replace**. | 1 |
| FR-X4 | Call `navigator.storage.persist()` on first run. Show an export reminder banner if `lastExportAt` is > 14 days old. | 1 / 3 |
| FR-X5 | **Attempt compaction.** Attempts older than 90 days fold into `unitAggregates`. Compaction runs on load at most once a day. | 2 |
| FR-X6 | **TTS:** pick the voice whose `lang` starts with `ro`, or the user's saved `voiceURI`. Default rate 0.9. If there's no Romanian voice, show a one-time banner with the Android setup steps (§8). Everything else keeps working. | 1 |
| FR-X7 | **Service worker:** cache-first for the shell and content, using a versioned cache name derived from `manifest.json.contentVersion` plus the app version. When a new version installs, show the toast "Update available — tap to refresh". | 1 |
| FR-X8 | **Web app manifest:** `display: standalone`, `start_url: "./"`, `scope: "./"`, a theme color, and 192/512 maskable icons. | 1 |
| FR-X9 | **Flag a sentence:** a note is stored locally. Settings lists the flags, each with a button that opens a pre-filled GitHub issue URL (`https://github.com/xferguson/DaciaGlot/issues/new?title=…&body=…&labels=content-flag`) and a "copy all" action. | 2 |

## 5. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-1 | **Performance:** first load < 300 KB over the wire, excluding content. Card-to-card transition < 100 ms on a mid-range Android. Content packs are lazy-loaded per level. |
| NFR-2 | **Storage:** state for 600 sentences after 6 months is < 2 MB (verified by a test that synthesizes such a state). |
| NFR-3 | **Accessibility:** tap targets ≥ 44 px; WCAG AA contrast in light and dark mode (`prefers-color-scheme`); the input has `lang="ro"`, `autocapitalize="off"`, `autocomplete="off"` and `spellcheck="false"`. |
| NFR-4 | **Correctness:** every pure module in `app/js/core/` has unit tests, and CI runs the tests plus the validator on every PR. |
| NFR-5 | **Privacy:** no analytics, no third-party requests at runtime. |
| NFR-6 | **Robustness:** corrupt or unknown state must never crash the app. On a parse failure, back up the raw string to `dg:v1:state.corrupt-<ts>`, start fresh, and show a banner. |

## 6. Curriculum (summary; the full pattern inventory is in CONTENT_GUIDE §6)

| Stage | CEFR | Focus |
|---|---|---|
| 1 | A1 core | *a fi / a avea* present + `nu`; past (*am* + participle); *vreau/pot/trebuie să* + 1st/2nd person; definite article (singular); question words; meta-language starters; `tu` |
| 2 | A1 → A2 entry | full present incl. *-ez/-esc*; noun plurals + definite plural; future (*o să*); direct and indirect object clitics; *mi-e* constructions; colloquial demonstratives |
| 3 | A2 | *să* 3rd person; conditional *aș*; reflexives; genitive-dative; *al/a/ai/ale*; clitic clusters; meta-language extended |
| 4 | A2+ → B1 entry | imperfect; *care / pe care*; *pe* object marking; subordinate clauses; *dumneavoastră*; *acesta / aceasta* |
| 5+ | B1 | pluperfect, perfect conditional, gerund, passive, narrative connectors (planned later) |

## 7. Phases and release criteria

| Phase | Release criteria (all must hold) | Tasks |
|---|---|---|
| **0 · Foundations** ✅ | Plan, deploy workflow, placeholder live | — |
| **1 · Core loop** ✅ | On Android/Brave: installs; a full Session runs offline with Romanian TTS; `lr` and `cz` cards work with diacritic leniency and highlighting; progress survives reload; export → reset → import round-trips; ≥100 valid sentences; CI green | T01–T10 |
| **2 · Building sentences** | Pattern focus yields known lexemes in the new pattern first (test); no new sentence has novelty > 2 (test); `kf`, `xf` and `sb` cards work; flags open GitHub issues; ≥300 sentences across all 9 situations | T11–T17 |
| **3 · Progress** | Dashboard shows A1 completion from the real state; can-dos become checkable; `er` cards work; the coverage report runs in CI with every A1 can-do having ≥5 sentences; 400–600 sentences | T18–T23 |
| **4 · A2 pack** | Stage 3–4 content and A2 manifest; formal register; optional audio packs | epic E4 (tasks written when Phase 3 lands) |
| **5 · Reading & personal** | Reading mode with tap-to-gloss feeding the selector; user-added sentences | epic E5 |

## 8. Operational notes

- **Deploy.** Merging to `main` runs `.github/workflows/deploy-pages.yml`: tests + validator, then Pages deploy of `app/`. PRs run checks only.
- **Android TTS setup, shown in-app when no voice is found:**
  1. Settings → System → Languages → Text-to-speech output → Preferred engine: *Speech Services by Google*.
  2. Tap ⚙ → Install voice data → Romanian.
- **Content risk accepted.** Romanian is machine-authored and checked against Dexonline paradigms, with no native review in v1. The flag button closes the loop.

## 9. Open questions (decide before the named phase)

| # | Question | Decide by |
|---|---|---|
| Q1 | Introduce *dumneavoastră* earlier for specific work situations? | Phase 4 |
| Q2 | Full-paradigm key-forms cards for top irregulars (*fi, avea, vrea, putea, face, merge, da, sta, lua*) already in Stage 1? **Default: yes, present tense only.** | Phase 2 |
| Q3 | Native-recorded audio for a core subset? | Phase 4 |
| Q4 | Multi-device via manual export to Drive is enough? | After Phase 3 |
| Q5 | **Redefine what A1/A2/B1 mean for this product.** The current mapping (Stages 1–2 = A1, CEFR-adapted can-dos, §6 and ARCHITECTURE §7.4) is provisional. The owner wants to revisit the level definitions before A2 content is planned. Keep level ids and manifests data-driven so they can change without code changes. | Before Phase 4 (revisit after Phase 3 data exists) |

## 10. Changes from PLAN v0 (verification findings)

The v0 plan was reviewed before this PRD was written. These defects or gaps were corrected:

1. **Clitic clusters couldn't be represented.** v0 tokens had a single `lex/form`, but *i-am*, *n-am* and *mi-e* are one orthographic token carrying two units. Tokens now carry `units[]` (CONTENT_GUIDE §2.3).
2. **Auxiliary ≠ lexical forms.** The past auxiliary is *am, ai, **a**, am, ați, au*, while lexical *a avea* is *am, ai, **are**, avem, aveți, au*. The conditional auxiliary is *aș, ai, ar, am, ați, ar*. These are now separate lexemes (`aux-perf`, `aux-cond`) instead of forms of `avea`.
3. **Pattern attempts lacked a lexeme**, so type frequency (P-4) couldn't be measured. Units can now name the pattern they realize, and attempts record the head lexeme.
4. **"Known unit" was ambiguous.** It is now defined exactly in ARCHITECTURE §6.1.
5. **Listen & recognize had no distractor rule.** It now has one (FR-D1).
6. **Sentence mastery was undefined** but was needed by can-dos and EN→RO unlocking. It is now defined (ARCHITECTURE §7.3).
7. **Phase 1 had no selection logic**, because i+1 lands in Phase 2. An interim order was added (FR-S4).
8. **The transform op vocabulary was free-form.** It is now a fixed enum, so the UI can render instructions and slot-building can derive from it.
9. **Hint behavior was referenced but unspecified.** It is now FR-D8.
10. **Deploy concurrency could cancel an in-flight Pages deploy on `main`.** `cancel-in-progress` is now limited to PRs.
11. **Quota and corruption handling were missing.** Added NFR-6 and FR-X1.
