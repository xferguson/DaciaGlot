# DaciaGlot — Content Guide

This guide is for agents authoring Romanian content. Read PRD §1 and §6 first.

---

## 1. Files

```
app/content/
  manifest.json          { "contentVersion": "2026.11.01-1", "packs": { "lexemes": [...], "sentences": [...] }, "levels": ["A1"] }
  patterns.json          [Pattern]
  levels/A1.json         Level
  lexemes/core.json      [Lexeme]   (split by pos or theme as files grow: verbs.json, nouns-work.json …)
  sentences/A1-<situation>.json   [Sentence]
```

Bump `contentVersion` (date + counter) in every PR that changes content.

## 2. Schemas

### 2.1 Lexeme

```json
{
  "id": "gasi",
  "lemma": "a găsi",
  "pos": "verb",
  "gloss": "to find",
  "lemmaGloss": "find",
  "freq": 412,
  "class": "IV-esc",
  "forms": {
    "inf": "a găsi",
    "pres1sg": "găsesc", "pres2sg": "găsești", "pres3sg": "găsește",
    "pres1pl": "găsim", "pres2pl": "găsiți", "pres3pl": "găsesc",
    "ppl": "găsit",
    "subj3": "să găsească"
  },
  "keyForms": ["pres1sg", "pres3sg", "ppl", "subj3"]
}
```

- **`id`**: ASCII, lowercase, no diacritics. Disambiguate homographs with a suffix (`sta-v`, `ei-pron`).
- **`pos`**: one of `verb | noun | adj | pron | det | adv | prep | conj | num | intj | aux | particle | phrase`.
- **`freq`**: a frequency rank (1 = most frequent). It may be approximate, and it is used only for ordering.
- **`trivial: true`**: set this for function words (*și, la, de, în, cu, pe, dar, că*). It means they count as known once seen.

**Form keys by part of speech** (include only what the sentences use, plus the `keyForms`):

| pos | Form keys |
|---|---|
| verb | `inf`, `pres1sg…pres3pl`, `ppl`, `subj1sg…subj3pl` (only 3sg/3pl differ from present for most verbs), `imp2sg`, `imp2pl`, `impf1sg…impf3pl` (Stage 4), `ger` (Stage 5) |
| noun | `sg`, `pl`, `sgDef`, `plDef`, `sgGenDat`, `plGenDat`, `voc` (rare). Add `gender: "m"|"f"|"n"` |
| adj | `msg`, `fsg`, `mpl`, `fpl`, plus definite forms only if used |
| pron (clitic) | `acc` (full: *îl*), `accShort` (*l-*), `dat` (*îi*), `datShort` (*i-*), etc. One lexeme per person/number: `pron-3pl` |
| aux | `aux-perf` (*am, ai, a, am, ați, au* → `1sg…3pl`), `aux-cond` (*aș, ai, ar, am, ați, ar*), `aux-fut-o` (invariable *o*) |

**Do not model the auxiliary as forms of `avea`.** Lexical *a avea* is *am, ai, **are**, avem, aveți, au*; the past auxiliary is *am, ai, **a**, am, ați, au*.

### 2.2 Pattern

```json
{
  "id": "perfect-compus",
  "name": "Past: am + participle",
  "stage": 1,
  "level": "A1",
  "requires": ["have-pres"],
  "minLexemesForProducing": 5,
  "slotLabel": "past"
}
```

`slotLabel` is the short English label slot-building shows for this pattern (`past`, `future`, `them`, `to him`, `not`, `would`, `want to`, …).

### 2.3 Sentence

```json
{
  "id": "s-a1-standup-0012",
  "ro": "Ieri am terminat sprintul.",
  "en": "We finished the sprint yesterday.",
  "accept": ["Am terminat sprintul ieri."],
  "level": "A1",
  "stage": 1,
  "situations": ["standup"],
  "patterns": ["perfect-compus", "def-sg"],
  "register": "neutral",
  "tokens": [
    { "t": "Ieri",      "units": [{ "lex": "ieri", "form": "base" }] },
    { "t": "am",        "units": [{ "lex": "aux-perf", "form": "1pl", "pattern": "perfect-compus" }], "glue": "aux" },
    { "t": "terminat",  "units": [{ "lex": "termina", "form": "ppl", "pattern": "perfect-compus", "head": true }], "cloze": true },
    { "t": "sprintul.", "units": [{ "lex": "sprint", "form": "sgDef", "pattern": "def-sg", "head": true }], "cloze": true }
  ],
  "transforms": [
    { "op": "negate",          "ro": "Ieri n-am terminat sprintul.", "accept": ["Ieri nu am terminat sprintul."],
      "targetTokens": [1] },
    { "op": "person:1pl>3sg",  "ro": "Ieri a terminat sprintul.", "en": "He/She finished the sprint yesterday.",
      "targetTokens": [1] }
  ],
  "canDo": ["A1-standup-yesterday"]
}
```

**Token rules**

- `t` is the orthographic token exactly as it appears in `ro`, including attached punctuation. Joining the `t` values with spaces must reproduce `ro` (the validator checks this).
- **A hyphenated clitic cluster is one token with several units.** For example, *i-am* → `[{lex:"pron-3pl", form:"accShort"}, {lex:"aux-perf", form:"1sg"}]`, and *n-am* → `[{lex:"nu", form:"short"}, {lex:"aux-perf", form:"1sg"}]`. The `nu` lexeme has forms `{ "base": "nu", "short": "n" }`. Elided forms are modeled as their own form keys so the validator's substring check (§4 rule 4) passes.
- `glue` takes the value `aux | clitic | neg | sa`. It marks a function-word token so the UI and stats can single out "glue" accuracy.
- `pattern` on a unit links that unit to the pattern it realizes. `head: true` marks the unit whose lexeme is recorded as `lx` for pattern attempts. Each pattern listed in `patterns[]` must have **exactly one** head unit in the sentence.
- `cloze: true` marks a token that can be blanked. Use it for content words and inflected forms. Use it on glue tokens deliberately, at least once per glue pattern per 5 sentences, because glue is a known weak spot.
- **Transforms:**
  - `targetTokens` gives the token indices *in the source sentence* that change. They are used to derive units for attempts and slots.
  - A transform may carry its own `en`. When it is missing, the UI shows only the instruction.

### 2.4 Level

```json
{
  "id": "A1",
  "requiredPatterns": ["be-pres", "have-pres", "neg-nu", "pres-12-high", "perfect-compus", "modal-sa-12", "def-sg", "wh-q", "meta-basic",
                        "pres-full", "pres-ez-esc", "noun-pl", "def-pl", "fut-o-sa", "clitic-acc", "clitic-dat",
                        "mi-e-construction", "dem-colloq"],
  "targetLexemes": ["fi", "avea", "vrea", "putea", "face", "merge", "..."],
  "canDos": [
    { "id": "A1-standup-yesterday", "situation": "standup", "text": "I can say what I did yesterday and will do today." }
  ]
}
```

Each can-do should have **≥5 linked sentences** by the end of Phase 3. Sentences link to a can-do through `canDo[]`.

## 3. Transform op vocabulary (fixed)

| op | Instruction shown | Notes |
|---|---|---|
| `negate` | "Make it negative" | |
| `affirm` | "Make it positive" | |
| `person:<a>><b>` | "→ she" / "→ we" … | `a`, `b` ∈ `1sg 2sg 3sg 1pl 2pl 3pl` |
| `tense:<a>><b>` | "→ past" / "→ future" / "→ present" | `a`, `b` ∈ `pres perf fut cond impf` |
| `add-obj:<pron>` | "Replace X with 'it/him/her/them'" | `pron` ∈ `acc-3sg-m acc-3sg-f acc-3pl-m acc-3pl-f acc-1sg acc-2sg acc-1pl acc-2pl` |
| `add-dat:<pron>` | "Add 'to me/him/…'" | analogous `dat-*` |
| `modal:<verb>` | "Start with 'I want / I can / I must'" | `verb` ∈ `vrea putea trebui` |
| `question` | "Make it a question" | |
| `plural` / `singular` | "→ plural" / "→ singular" | for the noun marked by `targetTokens` |
| `definite` / `indefinite` | "→ the X" / "→ a X" | |
| `formal` | "→ dumneavoastră" | Stage 4+ |

Adding an op requires updating this table **and** the UI instruction renderer in the same PR.

## 4. Validator rules (`scripts/validate-content.mjs`)

**Errors (exit 1):**

1. Duplicate ids within any type.
2. A token unit references an unknown lexeme, or a form key missing from that lexeme's `forms` (form `base` is allowed for uninflected lexemes).
3. Token `t` values joined with single spaces ≠ `ro`.
4. A unit's form value, normalized and with punctuation stripped, doesn't occur inside its token `t`. This catches wrong forms. Lexemes with `pos: phrase` and multi-unit clitic tokens are checked by substring.
5. A pattern in `patterns[]` is unknown, or lacks exactly one `head` unit.
6. A pattern's `requires` references an unknown pattern, the requires graph has a cycle, or a pattern requires one at a higher stage.
7. A sentence's `stage` is below the max stage of its patterns.
8. Cedilla characters `ş ţ Ş Ţ` appear anywhere (comma-below is required), or `ã` (which should be `ă`).
9. `register` or `situations` contains a value outside the allowed enums. `op` is not in §3.
10. `canDo` references an unknown can-do. `level` doesn't exist in the manifest.
11. A file under `app/js` or `app/css` is missing from the `sw.js` precache list.
12. `lemmaGloss` (optional) is not one lowercase word or a dotted compound (`be`, `get.up`), or a small-caps label (`NEG`), of at most 16 characters.

**Warnings:** a sentence with no `cloze` token; a sentence with no transforms (from Phase 2 on); `en` missing on a person transform; a lexeme with no sentences.

**Coverage report** (`--coverage` flag, Phase 3): per pattern, situation and can-do, the sentence counts, plus the distinct head lexemes per pattern. Anything under target is flagged (pattern < 10 sentences or < 6 head lexemes; can-do < 5; situation < 10).

## 5. Situations

| id | Scope |
|---|---|
| `standup` | yesterday/today/blockers, sprint, ticket, review, deploy, bug, estimate |
| `decisions` | propose, agree/disagree, prioritize, deadlines, trade-offs, "let's…" |
| `coaching` | 1:1s: open questions, encouragement, goals, feedback, "what do you need from me?" |
| `domain` | data, energy, grid, consumption, forecast, model, pipeline, AI |
| `table` | dinner/bar: ordering, toasts (*Noroc!*), preferences, compliments, small talk |
| `me` | my weekend, family, where I'm from, my job, my languages, my hobbies |
| `getting-to-know` | colleagues' hometowns, local food, customs and holidays, hobbies, "what do you like about…?" Curious and personal, not touristy |
| `news` | elections, government, opinions, reacting to headlines |
| `meta` | talking about the language and getting around missing words (§7) |

## 6. Pattern inventory (ids are fixed; add new ones at the end of a stage)

**Stage 1 (A1)**

| id | name | requires |
|---|---|---|
| `be-pres` | *a fi* present (sunt, ești, e/este, suntem, sunteți, sunt) | — |
| `have-pres` | *a avea* present (am, ai, are, avem, aveți, au) | — |
| `neg-nu` | negation with *nu* / *n-* | — |
| `def-sg` | definite article, singular nominative (-ul, -le, -a) | — |
| `wh-q` | question words (ce, cine, unde, când, cum, de ce, cât) | — |
| `pres-12-high` | present 1sg/2sg/3sg of high-frequency verbs (știu, vreau, pot, fac, merg, lucrez) | — |
| `perfect-compus` | past: aux-perf + participle | `have-pres` |
| `modal-sa-12` | *vreau/pot/trebuie să* + 1st/2nd person subjunctive | `pres-12-high` |
| `meta-basic` | meta-language starters (§7) | — |

**Stage 2 (A1 → A2)**

| id | name | requires |
|---|---|---|
| `pres-full` | present, all persons | `pres-12-high` |
| `pres-ez-esc` | *-ez / -esc* verb classes | `pres-full` |
| `noun-pl` | noun plurals, indefinite | `def-sg` |
| `def-pl` | definite plural (-ii, -ele, -le) | `noun-pl` |
| `fut-o-sa` | future: *o să* + subjunctive | `modal-sa-12` |
| `clitic-acc` | direct-object clitics (îl/l-, o, îi/i-, le; mă, te, ne, vă) incl. *am văzut-o* | `perfect-compus` |
| `clitic-dat` | indirect-object clitics (îmi/mi-, îți/ți-, îi/i-, ne/ni-, vă/vi-, le/li-), *îmi place* | `clitic-acc` |
| `mi-e-construction` | *mi-e foame / dor / frică / greu*, *mi-e dor de* | `clitic-dat` |
| `dem-colloq` | *ăsta, asta, ăștia, astea* (post- and pre-nominal) | `def-sg` |

**Stage 3 (A2):** `subj-3`, `cond-pres`, `reflexive`, `gen-dat-def`, `possessive-al`, `clitic-cluster`, `meta-extended`
**Stage 4 (A2+):** `imperfect`, `rel-care`, `dom-pe`, `subord`, `register-formal`, `dem-formal`

The Stage 3–4 `requires` edges are written by the Phase 4 content task.

## 7. Meta-language toolkit (`meta` situation, `meta-basic` pattern)

*Cum se spune …?* · *Cum se zice …?* · *Nu știu cuvântul, dar …* · *E un fel de …* · *E ca un/o …* · *Chestia aia care …* · *Un lucru pe care îl folosești când …* (Stage 3 for *pe care*) · *E un verb / un substantiv / un adjectiv care înseamnă …* · *Poți să repeți, te rog?* · *Mai încet, te rog.* · *Ce înseamnă „…"?* · *Adică …* · *Gen …*

## 8. Authoring rules

1. **Natural, spoken, contemporary Romanian.** Use what a colleague in Bucharest or Cluj would actually say: *tu*, with colloquial forms (*n-am*, *mi-e*, *ăsta*) as the primary `ro` and full forms in `accept`.
2. **One new thing.** When writing a batch, order sentences so each introduces ≤1 new lexeme or pattern relative to earlier sentences in the same stage. The validator can't enforce this, but the selector depends on enough i+1 paths existing.
3. **Reuse aggressively.** Each new pattern needs ≥6 distinct head lexemes that already appear elsewhere (type frequency).
4. **Sentence families.** Prefer 1 base sentence with 2–3 transforms over 3 unrelated sentences.
5. **Check every inflected form** against the [Dexonline](https://dexonline.ro) paradigm tables. Record any uncertainty in the PR description, not in the JSON.
6. **Short sentences.** Stage 1–2 sentences run 3–9 words, with one clause, except for *să* complements.
7. **Topical, personal and useful.** Prefer sentences the learner would actually say at standup, in a 1:1, at dinner, or about themself. Use realistic names (*Andrei, Ioana, Mihai, Elena, Radu, Cristina*) and Romanian places (*Cluj, Iași, Timișoara, Brașov, Constanța, Sibiu*).
8. **English glosses** should be natural, not word-for-word. Note ambiguity where it exists (*am terminat* = I/we finished, so pick one and stay consistent with the transform `en`).
9. **Never** use cedilla ş/ţ. Always use ș/ț (U+0219/U+021B).

## 9. Glossing (slot-building cards, EXP-06)

Slot cards label each changed slot with a Leipzig-style gloss of the *wanted form*, e.g. `[be.PRS.2SG]`, built by `leipzigFor(lexeme, formKey)` as `<lemma gloss>.<form gloss>`.

- The lemma part is `lemmaGloss` if the lexeme has one, else the first word of `gloss` with a leading *to* dropped (*to live (somewhere)* → `live`). Add `lemmaGloss` when that first word is ambiguous or misleading (*to be able, can* → `can`, not `be`), or for a grammatical word (`NEG`, `SBJV`, `AUX`). A `gloss` already in small caps is used as is.
- The form part comes from `LEIPZIG` in `app/js/core/cards.js` (`pres2sg → PRS.2SG`, `sgDef → SG.DEF`, `accShort → ACC.CL`). `base` and `short` add nothing.
- Pronoun lexemes (`pron-<person><number>[-m|f]`) lead with person and number: `2SG.ACC.CL`.
- If a result word can't be resolved to a lexeme form, the card falls back to the pattern's `slotLabel`.
