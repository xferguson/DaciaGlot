# DaciaGlot — Product & Build Plan

A lightweight, offline-first Progressive Web App for learning to **speak** Romanian, designed around one specific learner and the bottleneck uncovered in discovery. No backend; all state lives on the device.

---

## 1. Learner profile (discovery summary)

| Area | Finding |
|---|---|
| Background | Experienced polyglot with a linguistics degree (field methods, morphosyntax). French C1 (30 years), Spanish B1 (reads B2), Italian B1, Portuguese A2, Mandarin (degree), Turkish ~B1, some Polish. |
| Romanian now | Reads news with help. Hears it accurately (pronunciation and perception are strengths; often complimented). Can't produce beyond greetings. |
| What made languages stick | A channel tied to genuine interest: childhood/university (FR), capoeira songs (PT), music and TV (IT). Spanish has the most exposure but the least interest, and it's the weakest in conversation. **Interest beats exposure.** |
| What works for production | Rule-based, composable systems (Turkish agglutination, Mandarin syntax): learn the pattern, then generate sentences never heard before. |
| What fails | Memorization-heavy morphology (Polish, Romanian nouns and verbs): lexically conditioned alternations (*fată → fete*), irregular plurals, look-alike demonstratives, forms that need agreement across a phrase (oblique case). |
| Past Romanian attempts | Teach Yourself, Assimil, Duolingo. Topic-by-topic dialogues and lists that never add up to the ability to build sentences. Duolingo is repetitive and too rigid. |
| Tools liked | **Memrise**: sentence and word cards, audio after a correct answer (then shadow), freedom to choose and skip topics. **LingQ**: reading several articles on one topic so words recur. |
| Motivators | Visible progress > streaks. A system that adapts without overwhelming. Choice and freedom. Measured by **what I can produce**; words known without patterns is actively demotivating. |
| Errors | Doesn't freeze. Wants to *notice* errors so they get fixed next time. |
| Context | Manages a software team in a Romanian office (energy data, AI, Scrum). Supportive colleagues, but a power dynamic: wants to arrive able to speak, not take free lessons from reports. Romanian friends. |
| 6-month goal | Run some meetings in Romanian. Have dinner or bar conversation with the team in Romania: hear about their lives, talk about own life, get around missing words. |
| Study time | Mornings or evenings (20–40 min, not daily), 5-minute gaps for flashcards. Commute is **not** study time (driving). |
| Device | Android, Brave browser, phone-first. |

## 2. Diagnosis

1. **The bottleneck is form retrieval during production.** Not phonology, comprehension of structure, grammatical concepts, or speaking anxiety. Comprehension stalls for the same reason: forms aren't recognized fast enough.
2. **The learner already knows the rules.** Explicit rules alone won't unlock anything. What's missing is **volume of examples across known words** (high type frequency) until patterns become automatic. The app's job is to deliver that volume, not to explain grammar.
3. **The glue is a specific blind spot.** Clitic and auxiliary clusters (*nu i-am găsit*, *nu l-am*, *mi-e*) were misparsed through English shapes. They need dedicated practice.
4. **Topic-ordered materials scatter forms.** The app has to order material by *what you already know + one new thing*, not by chapter.
5. **Interest needs a deliberate hook.** Content is built around the learner's real worlds: software management, coaching, energy data, AI, Romanian politics, getting to know colleagues.

## 3. Design principles

1. **Sentences, not lists.** Every studied item lives inside a sentence.
2. **Exactly one new thing at a time (i+1).** New sentences are chosen so that all but one unit is already known.
3. **Phrase first, then parts (usage-based SLA).** A word is met inside sentences first. Its key-forms card unlocks only after it has been seen in several sentences. Then it appears in transformations.
4. **Type frequency builds patterns.** A new pattern is introduced and practiced across words you already know.
5. **Order follows processability.** Word-internal morphology (person, definite article) comes before morphology that needs agreement across a phrase (genitive-dative, *al/a/ai/ale*).
6. **Production is the measure.** Progress is shown as patterns and forms *produced*, and as can-do statements. Words known is secondary.
7. **Audio is the reward.** After a correct answer, the sentence plays so you can shadow it. No recording, no pronunciation scoring.
8. **Light feedback.** Correct sentence + audio + a subtle highlight on the wrong token. No explanations.
9. **Freedom with guidance.** Enter by Situation or by Pattern. The app re-prioritizes either one around what you already know.
10. **Local-first and portable.** Works offline, keeps no account, and has explicit backup/export.

## 4. Curriculum architecture

### 4.1 Levels → Stages → Patterns

Content is organized on three axes. Every sentence is tagged on all of them:

- **CEFR level** (A1, A2, B1, …): the outer frame used to track completion and plan future content.
- **Stage**: the acquisition sequence within and across levels. Determines pattern prerequisites.
- **Situation**: what the sentence is *about*.

| Stage | CEFR | Patterns (ids in parentheses) |
|---|---|---|
| 1 | A1 core | ***a fi* / *a avea*:** present and negation (`be-pres`, `have-pres`, `neg-nu`). **Past tense:** *am* + participle (`perfect-compus`). **Modal + *să*:** *vreau/pot/trebuie să* + 1st/2nd person, which match the present (`modal-sa-12`). **Definite article:** nominative singular, *-ul/-le/-a* (`def-sg`). **Questions:** question words (`wh-q`). **Talking around missing words:** starter phrases (`meta-basic`). **Register:** `tu`. |
| 2 | A1 complete → A2 entry | **Full present:** all persons, including the *-ez/-esc* classes (`pres-full`, `pres-ez-esc`). **Nouns:** plural and definite plural (`noun-pl`, `def-pl`). **Future:** *o să* + verb (`fut-o-sa`). **Object pronouns:** direct-object clitics, including *l-am, am văzut-o* (`clitic-acc`). **Indirect-object pronouns:** dative clitics, including *îmi place, mi-e dor/foame* (`clitic-dat`, `mi-e-construction`). **Demonstratives:** colloquial *ăsta/asta/ăștia/astea* (`dem-colloq`). |
| 3 | A2 | ***să* form:** 3rd person, *să facă, să meargă* (`subj-3`). **Conditional:** *aș* + verb (`cond-pres`). **Reflexives:** *mă, te, se* (`reflexive`). **Genitive-dative:** *colegului, echipei* (`gen-dat-def`). **Possessive:** *al/a/ai/ale* (`possessive-al`). **Pronoun clusters:** *i-am spus, mi-l dai* (`clitic-cluster`). **Talking around missing words:** extended (`meta-extended`). |
| 4 | A2+ → B1 entry | **Imperfect** (`imperfect`). **Relative clauses:** *care, pe care* (`rel-care`). **Object marking:** *pe* (`dom-pe`). **Longer sentences:** *că / să / dacă / când* clauses (`subord`). **Formal register:** *dumneavoastră* (`register-formal`). **Written demonstratives:** *acesta/aceasta* (`dem-formal`). |
| 5+ | B1 | **Past forms:** pluperfect, perfect conditional (*aș fi vrut*). **Gerund.** **Passive.** **Narrative and argument:** connectors for telling stories and making a case. Planned once Stage 4 is underway. |

**Register policy.** *Tu* is the default (typical in Romanian software teams). Each sentence carries `register: colloquial | neutral | formal | written`. Formal *dumneavoastră* and written demonstratives arrive in Stage 4. Colloquial forms (*ăsta*, *n-am*, *mi-e*) are taught as the main spoken forms, with full forms (*nu am*) accepted as answers.

### 4.2 CEFR completion tracking

Each level has a **manifest**:

- **Can-do statements**, written per situation, adapted from the Council of Europe CEFR Companion Volume (2020) descriptors.
- **Required patterns.**
- **A target lexeme set.**

A level shows as complete when all three hold:

- Every required pattern is at **Producing** or above (see §8).
- ≥80% of the level's can-do statements are checked. These are self-assessed, but each one is unlocked only after its linked sentences reach the Producing state.
- Lexeme coverage passes the target threshold.

The level manifest also tells us **where to write content next**: uncovered can-dos and thin patterns show up as gaps in a `content-coverage` report produced by the validation script.

Version 1 targets **400–600 sentences covering Stages 1–2**, roughly all of A1 with some A2. A2 (Stage 3–4) and B1 come later as content packs, with no code changes.

### 4.3 Situations

| id | Situation | Examples of what it covers |
|---|---|---|
| `standup` | Standup & Scrum | yesterday / today / blockers, sprint, ticket, review, deploy |
| `decisions` | Decisions & planning | proposing, agreeing, disagreeing, priorities, deadlines |
| `coaching` | 1:1 coaching & feedback | open questions, encouragement, goals, "what do you need from me?" |
| `domain` | Data, energy & AI | data, models, pipelines, the grid, consumption, forecasts |
| `table` | Team dinner / at the bar | ordering, toasts, preferences, small talk |
| `me` | Me & my life | weekend, family, where I'm from, my work, my languages |
| `getting-to-know` | Getting to know you | hometowns, local food, customs, holidays, hobbies ("what's your favorite dish from there?") |
| `news` | Romanian news & politics | elections, government, opinions, reading headlines |
| `meta` | Talking about the language | getting around missing words |

**The `meta` toolkit (Stage 1 starters)** is the Romanian version of the learner's Italian habit (*come si dice*, *una cosa che…*, *non so, ma quando faccio…*):

- *Cum se spune…?* · *Cum se zice…?*
- *Nu știu cuvântul, dar…*
- *E un fel de…* · *E ca un/o…*
- *Chestia aia care…* · *Un lucru pe care îl folosești când…*
- *E un verb / un substantiv / un adjectiv care înseamnă…*
- *Poți să repeți, te rog?* · *Mai încet, te rog.* · *Ce înseamnă „…"?*
- *Adică…* · *Gen…* (colloquial "like")

## 5. Content model

Content is static JSON shipped with the app, split into **packs** so new levels can be added by dropping in files and bumping the manifest. IDs are stable forever, so progress survives content updates.

```
app/content/
  manifest.json            # packs, versions, levels
  patterns.json            # pattern definitions + prerequisites (DAG)
  levels/A1.json           # can-dos, required patterns, target lexemes
  lexemes/*.json           # lexemes with key forms
  sentences/A1-standup.json, A1-me.json, …
```

**Lexeme**

```json
{
  "id": "gasi",
  "pos": "verb",
  "gloss": "to find",
  "class": "IV-esc",
  "freq": 412,
  "forms": {
    "inf": "a găsi", "pres1sg": "găsesc", "pres2sg": "găsești", "pres3sg": "găsește",
    "pres1pl": "găsim", "pres2pl": "găsiți", "pres3pl": "găsesc",
    "ppl": "găsit", "subj3": "să găsească"
  },
  "keyForms": ["inf", "pres1sg", "pres3sg", "ppl", "subj3"]
}
```

```json
{
  "id": "casa", "pos": "noun", "gloss": "house", "gender": "f",
  "forms": { "sg": "casă", "pl": "case", "sgDef": "casa", "plDef": "casele", "sgGenDat": "casei" },
  "keyForms": ["sg", "pl", "sgDef", "sgGenDat"]
}
```

**Pattern**

```json
{
  "id": "perfect-compus",
  "name": "Past tense: am + participle",
  "stage": 1, "level": "A1",
  "requires": ["have-pres"],
  "minLexemesForProducing": 5
}
```

**Sentence**

```json
{
  "id": "s-a1-standup-0012",
  "ro": "Ieri am terminat sprintul.",
  "en": "We finished the sprint yesterday.",
  "accept": ["Am terminat sprintul ieri."],
  "level": "A1", "stage": 1,
  "situations": ["standup"],
  "patterns": ["perfect-compus", "def-sg"],
  "register": "neutral",
  "tokens": [
    { "t": "Ieri" , "lex": "ieri" },
    { "t": "am", "lex": "avea", "form": "aux1pl", "glue": true },
    { "t": "terminat", "lex": "termina", "form": "ppl", "cloze": true },
    { "t": "sprintul", "lex": "sprint", "form": "sgDef", "cloze": true }
  ],
  "transforms": [
    { "op": "negate", "ro": "Ieri n-am terminat sprintul.", "accept": ["Ieri nu am terminat sprintul."] },
    { "op": "person:1pl→3sg", "ro": "Ieri a terminat sprintul." }
  ],
  "canDo": ["A1-standup-yesterday"]
}
```

**Units.** The things the scheduler tracks knowledge of are **lexeme-form units** (`termina.ppl`, `sprint.sgDef`) and **pattern units** (`perfect-compus`). A sentence's unit set is derived from its tokens and patterns.

**Content production and QA**

- Sentences are authored in batches per situation and stage. Forms are checked against [Dexonline](https://dexonline.ro) paradigms.
- A Node validation script (run in CI) checks:
  - unique IDs
  - every token's `lex` and `form` exists
  - every pattern's prerequisites exist (no cycles)
  - every sentence's stage ≥ the stage of its patterns
  - transforms are non-empty
  - comma-below diacritics only (ș ț, never the cedilla forms ş ţ)

  It also produces a **coverage report**: sentences per pattern, per situation, and per can-do, plus thin spots.
- **Accepted risk:** no native review for version 1. An in-app **Flag this sentence** button stands in for it (§9.6).

## 6. Learning engine

### 6.1 Card types

| Card | Prompt → answer | Unlocks when |
|---|---|---|
| **Listen & recognize** | Hear the sentence → pick the matching text (first meeting with a sentence) | Sentence selected as new |
| **Cloze (audio)** | Hear the sentence + see it with one gap → type the missing form | After listen & recognize |
| **Transformation** | See a sentence + an instruction (*negate*, *→ she*, *add "them"*, *→ future*) → type the new sentence | Sentence's lexemes have had their key forms seen. Pattern prerequisites met. |
| **Slot-building** | `[nu] + [them] + [past] + găsi` → type the sentence | Pattern at Seen or above |
| **Key forms** | Lemma + gloss → type the requested form (e.g. *găsi* · 3sg) | Lexeme met in ≥2 sentences |
| **EN → RO** | English → type the Romanian sentence | Sentence's cloze and transformation cards are at Good or above |

Default drill weighting follows the learner's ranking: transformation > cloze > slot-building > EN→RO.

**The audio loop.** Audio plays when the card is presented (for listening and cloze cards). It plays again after **every correct answer**, as the cue to shadow. On a wrong answer, the correct sentence is shown and played.

### 6.2 Answer checking

1. **Normalize the text.**
   - Unicode NFC.
   - Lowercase.
   - Trim and collapse whitespace.
   - Strip final punctuation.
   - Map cedilla ş/ţ → comma ș/ț. Android keyboards produce both.
   - Unify hyphen variants.
2. **Exact match** against `ro` or `accept[]` → **correct**.
3. **Match after stripping diacritics** → **correct, with a diacritics note** (the missing marks are shown highlighted).
4. **Otherwise wrong.** A token-level diff marks the first differing token(s) with a subtle highlight. No explanation is given.
5. **Contracted and full forms are interchangeable** (*n-am* ⇄ *nu am*, *mi-e* ⇄ *îmi este*), through a small equivalence table. This saves listing every variant in `accept`.

**Input UI.** A diacritic bar (ă â î ș ț) sits above the keyboard and inserts at the cursor. Long-press inserts the capital.

### 6.3 Scheduling (SRS)

- **FSRS** (Free Spaced Repetition Scheduler) with default parameters. A small in-repo implementation keeps the app free of dependencies, and it is unit-tested.
- **Grades are inferred, with no buttons:**
  - correct on the first try → *Good*
  - correct with only a diacritics note → *Good*
  - correct after revealing the gap's first letter (optional hint) → *Hard*
  - wrong → *Again*

  An optional "too easy" tap marks a card *Easy*.
- **Credit flows to units.** Each graded production records an **attempt** on each unit the answer required: the cloze target, the transformed tokens, or every non-trivial token for EN→RO. Each attempt stores `{unitId, lexeme, correct, ts}`. Mastery states (§8) are derived from these attempts.

### 6.4 Selecting new material (i+1 with cross-prioritization)

When the session needs a new sentence:

1. **Candidates** are unseen sentences whose patterns have all prerequisites at Seen or above, and whose stage is ≤ the current stage + 1.
2. **Novelty** = the number of the sentence's units not yet known. A unit is *known* once it has ≥1 correct production or a passed listen-and-recognize, for lexeme-forms with a lemma already met.
3. **Score** (higher is better):
   - `+100` if novelty == 1, `+40` if novelty == 2, otherwise excluded (novelty 0 sentences go to the review pool as extra practice)
   - `+50` if it matches the chosen **focus**, a situation or a pattern
   - **Cross-prioritization:**
     - **Pattern focus:** `+30` per unit whose lexeme is already known. This puts known verbs into the new tense first: learned *a mânca* in `table`, then chose `perfect-compus`? You get *am mâncat*.
     - **Situation focus:** `+30` if the novel unit is a *word* rather than a *pattern*. New situations bring new vocabulary inside familiar grammar first.
   - `+0–20` scaled by lexeme frequency
   - `−15` per unit whose pattern is still at Seen (spreads the load)
4. Pick the top-scoring sentence, with mild randomness among near-ties so sessions don't feel mechanical.

If no candidate with novelty ≤ 2 exists for the chosen focus, the app says so and suggests the prerequisite pattern or situation that would open it up. It doesn't hand out a harder sentence silently.

### 6.5 Sessions

| Mode | Contents | Length |
|---|---|---|
| **Quick** | Due reviews only, most-overdue first | ~5 min or ~15 cards, whichever comes first |
| **Session** | Due reviews + new sentences (default 8, adjustable) + unlocked key-forms and transformation cards, interleaved | 20–40 min; the app shows an estimate up front |
| **Focus** | Same as Session, restricted to one situation or pattern | User-chosen |

Reviews are never allowed to pile up silently. The home screen shows the due count, and Quick mode clears the most-overdue first.

## 7. Screens

1. **Home**
   - Due count and the **Quick** / **Session** buttons.
   - Current level ring (e.g. "A1 · 38%").
   - "Next up" suggestion.
   - Two tabs to choose focus: **Situations** and **Patterns**.
2. **Situation list / Pattern list.** Each row shows its mastery bar and how many sentences are available *at your level right now* (i+1 candidates). Tapping one starts a Focus session.
3. **Card screen.**
   - Prompt, input, and the diacritic bar.
   - Feedback: green, or the highlighted token + correct sentence. Audio plays.
   - **Flag** icon and **replay audio**.
   - Tiny progress bar for the session.
4. **Session summary.**
   - Cards done, new sentences, patterns that moved state ("*perfect-compus*: Seen → Producing").
   - Forms produced today.
5. **Progress dashboard** (§8).
6. **Lexeme detail.** Opened by tapping any word in a reviewed sentence. Shows key forms, sentences you know that contain it, and its mastery.
7. **Settings.**
   - New per session.
   - Audio rate and voice picker.
   - Auto-play on/off.
   - Register filter.
   - Export / import backup.
   - Flagged sentences.
   - Reset.

Phone-first layout with large tap targets. Inputs are designed for one-handed use.

## 8. Progress and measurement

**Pattern states.** These are derived from attempts and drive most of the dashboard:

| State | Rule |
|---|---|
| Not started | No sentences seen |
| Seen | ≥1 sentence met |
| Producing | Correct productions across **≥ `minLexemesForProducing` distinct lexemes** (default 5), with ≥70% accuracy over the last 20 attempts |
| Automatic | Producing + ≥90% accuracy over the last 20 attempts across ≥10 lexemes, with the most recent attempt at a review interval ≥ 21 days |

**Lexeme-form units** use the same scheme in lighter form: seen → produced → stable (FSRS stability ≥ 21 days).

**Dashboard sections, in priority order:**

1. **Level progress.** A1 / A2 / B1 rings, with a breakdown into patterns at Producing+, can-dos checked, and lexeme coverage.
2. **Patterns grid.** Grouped by stage and colored by state. Tap a pattern to see its accuracy trend and example sentences.
3. **Can-do checklist per situation.** For example: *"I can give a standup update about yesterday and today" ✓*. Each can-do becomes checkable once its linked sentences are Producing.
4. **Production stats.**
   - Distinct forms produced correctly: total and this week.
   - Sentences mastered.
   - Words known, shown *alongside* the above and never alone.
5. **History.** A weekly chart of forms produced and minutes studied. A 14-day review forecast.

There is no streak counter on the home screen. A "days studied this month" figure lives in History.

## 9. Technical architecture

### 9.1 Stack

- **Static, no build step:** vanilla JavaScript ES modules, HTML, CSS. Types are documented with JSDoc. No framework is needed at this size, and there's no build to break.
- **Tests:** `node --test` on the pure modules (normalization, diff, FSRS, selection, mastery derivation, content validation). There are no runtime dependencies.
- **Layout:**

```
app/                 # deployed as the site root
  index.html, manifest.webmanifest, sw.js, icons/
  js/
    main.js, router.js, ui/…
    core/ normalize.js, diff.js, fsrs.js, select.js, mastery.js, session.js
    data/ content.js (loader), store.js (persistence), tts.js
  content/ …         # §5
scripts/
  validate-content.mjs
test/
  *.test.mjs
.github/workflows/
  deploy-pages.yml   # tests + validation + deploy to GitHub Pages on main
docs/PLAN.md
```

### 9.2 Persistence (localStorage)

- A single namespaced, versioned document: `dg:v1:state`. It holds card states, attempts (compacted, see below), settings, flags, and a content version.
- **Size budget.** About 600 sentences × ~4 cards × ~150 B, plus attempts. That stays well under the ~5 MB localStorage quota. Attempts older than 90 days are compacted into per-unit aggregates.
- **Writes** go through `store.js` (debounced, wrapped in try/catch). Schema migrations are keyed by version.
- **Persistence request.** The app calls `navigator.storage.persist()` on first run to reduce the risk of eviction.
- **Backup:**
  - **Export** downloads a dated JSON file. Android can save it to Drive.
  - **Import** validates the file and merges it, or replaces existing progress.
  - The app shows a gentle export reminder every 14 days.
- **Migration path.** If the data ever outgrows localStorage, `store.js` swaps to IndexedDB behind the same interface.

### 9.3 Audio

- **Version 1:** the Web Speech API `speechSynthesis` with a `ro-RO` voice. The voice is picked automatically and can be overridden in Settings. The sentence is spoken at rate 0.9 by default. Long-pressing replay plays it slowly (0.7).
- **One-time Android setup:**
  1. Android Settings → System → Languages → Text-to-speech output → Preferred engine: Speech Services by Google.
  2. Install the Romanian voice data.
- **Fallback.** If no Romanian voice is found, a banner explains the setup above, and everything except audio keeps working.
- **Later:** optional downloadable **audio packs** (pre-generated MP3/Opus per sentence, referenced by sentence ID). They are cached by the service worker on demand, and the app prefers them over TTS when present.

### 9.4 Offline / PWA

- **Service worker.** Cache-first for the app shell and content packs, with versioned caches. A new content version triggers an "Update available, tap to refresh" toast.
- **Manifest.** Standalone display, theme colors, maskable icons. Installable from Brave via "Add to Home screen".

### 9.5 Deployment

- `.github/workflows/deploy-pages.yml`: on push to `main` (and via manual dispatch) it:
  1. runs the tests and content validation
  2. uploads `app/` as the Pages artifact
  3. deploys it with `actions/deploy-pages`
- It also runs tests and validation on pull requests, without deploying.
- **Live URL:** `https://xferguson.github.io/DaciaGlot/`. All asset paths are relative, so the subpath works.

**One-time setup by the repo owner:**

1. **Settings → Pages → Build and deployment → Source: "GitHub Actions".**
2. **Settings → Actions → General.** Confirm that "Allow all actions and reusable workflows" is selected. (Workflow permissions can stay read-only; the workflow requests its own `pages: write` and `id-token: write`.)
3. **Merge the PR into `main`.** The workflow runs, and the site appears at the URL above.
   - It can also be started manually: **Actions → Deploy to GitHub Pages → Run workflow**.

### 9.6 Flagging sentences (no backend)

Tapping **Flag** saves `{sentenceId, note, ts}` locally. In Settings → Flagged sentences, each flag has a button that opens a **pre-filled GitHub "New issue" URL** containing the sentence ID, text and note. Nothing is sent without your tap. Flags can also be copied as a batch.

## 10. Phased delivery

| Phase | Scope | Done when |
|---|---|---|
| **0 · Foundations** *(this PR)* | Plan, deploy workflow, placeholder page | Pages enabled; placeholder live at the Pages URL |
| **1 · Core loop** | Content loader + validator, store + export/import, normalization/diff, FSRS, listen-and-recognize and cloze cards, TTS + diacritic bar, Quick/Session modes, PWA install + offline. **~100 Stage-1 sentences** across `standup`, `me`, `meta`, `table` | Installed on Android/Brave; a full session works offline with audio; progress survives reload and export/import round-trips |
| **2 · Building sentences** | i+1 selection with cross-prioritization; Situations/Patterns tabs and Focus mode; key-forms cards and the unlock chain; transformation and slot-building cards; flagging. **Content → ~300** (Stage 1 complete, Stage 2 started, all 9 situations seeded) | Choosing a pattern yields known verbs in the new form first; no new sentence ever has >2 unknown units |
| **3 · Progress** | Mastery derivation, dashboard, A1 manifest + can-dos, session summary, history and forecast, EN→RO cards, coverage report in CI. **Content → 400–600** (Stages 1–2) | Dashboard shows A1 completion; coverage report shows every A1 can-do with ≥5 sentences |
| **4 · A2 pack** | Stage 3–4 content, formal register, `meta-extended`; optional audio packs | A2 ring appears and fills; formal sentences filterable |
| **5 · Reading & personal** | Reading mode: short texts on work and politics, tap a word for gloss + form + lexeme link, LingQ-style known/unknown marking feeding the selector. Add-your-own sentences. B1 planning | Can read a short news-style text in-app and send unknown words into the SRS |

Each phase is a PR to `main`, and each merge deploys automatically.

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Machine-authored Romanian sounds unnatural | Dexonline form checks, conservative sentence style, the Flag button, and native spot-checks when possible |
| Brave or Android lacks a Romanian TTS voice, or privacy settings hide voices | Detect and show setup steps; test on the actual device in Phase 1; audio packs as fallback |
| localStorage cleared or evicted | `storage.persist()`, export reminders, import/merge |
| Content authoring becomes the bottleneck | Pack-based content with a coverage report pointing at gaps; sentence families (one base sentence + several transforms) multiply practice per authored sentence |
| Selection gets stuck (no i+1 candidates for a focus) | An explicit message suggesting the prerequisite, not a silent fallback to harder sentences |
| Engagement drops when content isn't interesting | Situations drawn from the learner's real life; Stage 5 reading on chosen topics |

## 12. Open items to revisit

- When to introduce *dumneavoastră* earlier than Stage 4 if a work situation demands it (e.g. senior external stakeholders).
- Whether the key-forms cards should drill full paradigms for the very high-frequency irregulars (*a fi, a avea, a vrea, a putea, a face, a merge, a da, a sta, a lua*) even in Stage 1.
- Native-recorded audio for a core subset, if a willing friend appears.
- Optional sync via a user-owned file (e.g. exporting to Drive) if multi-device use becomes a need.
