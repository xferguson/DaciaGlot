# T30 · Leipzig glosses on slot-building cards

| | |
|---|---|
| **Phase** | 3.5 |
| **Depends on** | none |
| **Can run in parallel with** | T25–T29 |
| **Experiment** | [EXP-06](../EXPERIMENTS.md#exp-06--leipzig-glosses-on-slot-building-cards--t30) |

## Owns (files you may create or change)

- `app/js/core/cards.js` (`LEIPZIG`, `leipzigFor`, `slotsFor`)
- `app/js/ui/views/card-slot.js` (render the gloss), `app/css/app.css` (gloss style)
- `app/content/lexemes/*.json` (optional `lemmaGloss` where `gloss` is too long or ambiguous)
- `scripts/validate-content.mjs` (rule: `lemmaGloss`, if present, is one lowercase word or a dotted compound, ≤ 16 chars)
- `test/cards-xf.test.mjs`, `test/validate.test.mjs`
- `app/js/version.js`, `app/sw.js` (version only)
- `docs/CONTENT_GUIDE.md` (lexeme schema: `lemmaGloss`; a glossing section), `docs/ARCHITECTURE.md` §3 (`slotsFor` output)

## Read first (only these)

- PRD §4.2 (FR-D5), §4.8 (FR-R6)
- ARCHITECTURE §3
- CONTENT_GUIDE lexeme schema and §8
- `docs/EXPERIMENTS.md` · EXP-06

## Goal

Slot labels like `[am/is/are]` or `[I / you]` don't say which form is wanted, and they caused wrong answers. The owner has a linguistics degree and wants form-specific **Leipzig-style** glosses: `[be.PRS.2SG]`. The scope is slot-building cards only.

## Spec

- `LEIPZIG` maps every form key in `FORM_LABELS` to a Leipzig gloss. Representative entries:
  - `inf → INF`, `pres1sg → PRS.1SG`, `pres3pl → PRS.3PL`, `ppl → PTCP`
  - `subj1sg → SBJV.1SG`, `subj3 → SBJV.3`, `imp2sg → IMP.2SG`, `impf2sg → IMPF.2SG`, `ger → GER`
  - `sg → SG`, `pl → PL`, `sgDef → SG.DEF`, `plDef → PL.DEF`, `sgGenDat → SG.DEF.GEN-DAT`, `plGenDat → PL.DEF.GEN-DAT`, `voc → VOC`
  - `msg → M.SG`, `fsg → F.SG`, `mpl → M.PL`, `fpl → F.PL`
  - `acc → ACC`, `accShort → ACC.CL`, `dat → DAT`, `datShort → DAT.CL`
  - `base` → no suffix
  - Pronoun lexemes put person/number first (`2SG.ACC.CL`).
- `leipzigFor(lexeme, formKey) → string`: `<lemmaGloss ?? first word of gloss>.<LEIPZIG[formKey]>`, e.g. `be.PRS.2SG`, `live.PRS.1SG`, `NEG` for *nu* (a gloss already in small caps style is used as is).
- `slotsFor`:
  - For each slot, resolve the result token(s) in the run to `(lex, form)`. Use the source `targetTokens`' lexemes first (look the result text up in that lexeme's `forms`), then the existing `formIndex`.
  - The slot gets `gloss: string[]`, one per resolved token. `labels` (pattern `slotLabel`) is kept as the fallback when nothing resolves.
- `card-slot.js` renders `[be.PRS.2SG]` in a monospace-ish small-caps style (CSS token), with the pattern label as a `title`/aria-label.

## Acceptance criteria

- [ ] Tests: `LEIPZIG` covers every `FORM_LABELS` key.
- [ ] Tests: the slot for *Ești din Cluj* (from *Sunt din Cluj*, op `person:1sg>2sg`) is `be.PRS.2SG`; a pronoun clitic slot gives its person/number + case + `CL`.
- [ ] Tests: an unresolvable slot falls back to the pattern `slotLabel`.
- [ ] Validator rule for `lemmaGloss` with tests; all content passes.
- [ ] Headless run: the slot card shows the Leipzig label at phone width, light and dark.
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. `docs/STATUS.md` updated. EXP-06 is `live since <merge date>`.
