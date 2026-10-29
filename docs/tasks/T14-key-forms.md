# T14 · Key-forms cards and unlock chain

| | |
|---|---|
| **Phase** | 2 |
| **Depends on** | T08 |
| **Can run in parallel with** | T11, T12, T15, T16, T17 |

## Owns (files you may create or change)

- `app/js/ui/views/card-keyform.js`
- `app/js/core/cards.js` (kf unlock + generation)
- `test/cards-kf.test.mjs`

## Read first (only these)

- PRD §3 (P-3), §4.2 (FR-D3), §9 (Q2)
- ARCHITECTURE §3, §4 (`lexemeSentences`)
- CONTENT_GUIDE §2.1

## Goal

Turn words met in sentences into explicit form practice, in natural acquisition order.

## Spec

- Unlock: a lexeme's `kf` cards are introduced when `lexemeSentences[lex].length ≥ 2`. Introduce at most 3 `kf` cards per session per lexeme, ordered by `keyForms` order.
- Prompt: lemma, gloss and a human label for the form (`pres1sg` → "eu · prezent", `ppl` → "participiu (am …)", `subj3` → "el/ea · să …", `sgDef` → "the … (sg.)", `sgGenDat` → "of/to the … (sg.)"). Keep the label map in `cards.js` for reuse.
- After a correct answer, play an example sentence from the learner's seen sentences that contains that form, if one exists; otherwise play the form alone.
- Attempts record the unit `<lex>.<form>`.

## Acceptance criteria

- [ ] Tests: unlock threshold; per-session cap; ordering; label map covers every form key used in content.
- [ ] A Session after meeting a verb in 2 sentences includes its kf cards.
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

Full paradigm tables UI.
