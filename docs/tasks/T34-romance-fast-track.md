# T34 · Romance fast-track: transparent vs divergent material

| | |
|---|---|
| **Phase** | 3.6 |
| **Depends on** | T33 |
| **Can run in parallel with** | T35, T36 (content part can start any time) |
| **Experiment** | [EXP-08](../EXPERIMENTS.md#exp-08--fast-intake-romance-fast-track--t33-t34) |

## Owns (files you may create or change)

- `app/content/lexemes/*.json` (`transparent` flag), `app/content/patterns.json` (`divergent` flag)
- `scripts/validate-content.mjs` (rule for the new fields; coverage report counts)
- `app/js/core/select.js` (novelty cap ignores transparent units), `app/js/core/session.js` (`applyCheck` rung skip)
- `test/select.test.mjs`, `test/session.test.mjs`, `test/content.test.mjs`
- `app/js/version.js`, `app/sw.js` (version only)
- `docs/CONTENT_GUIDE.md` §2.1, §2.2, §4, new §10; `docs/ARCHITECTURE.md` §2, §6, §8; `docs/PRD.md` new FR-V3; `docs/EXPERIMENTS.md` EXP-08 status

## Read first (only these)

- `docs/EXPERIMENTS.md` · Check-in 2026-11-01 and EXP-08
- CONTENT_GUIDE §2.1, §2.2, §4, §6, §8
- ARCHITECTURE §6, §8

## Goal

The owner speaks French, Italian, Spanish and Portuguese. Things they can guess from those should fly by (*problemă*, *important*); things they can't (*oraș*, *a locui*) keep full repetition; repetition should go to what's Romanian-specific.

## Spec

- Lexeme field `transparent: true` when a speaker of FR/IT/ES/PT would recognise the lemma **and** produce its forms by analogy (e.g. *problemă*, *a lucra*, *important*). Leave it off when the meaning or the forms surprise (*a locui*, *oraș*, *a găsi*, irregular paradigms). Mark conservatively: when unsure, leave it off.
- Pattern field `divergent: true` for: `def-sg`, `def-pl`, `clitic-acc`, `clitic-dat`, `mi-e-construction`, `modal-sa-12`, `fut-o-sa`, `noun-pl` (neuter), `pres-ez-esc`, and any later case/vocative patterns. Others default to not divergent.
- Validator: both fields are optional booleans; `--coverage` lists counts per pattern and the share of transparent lexemes.
- Selection: units of transparent lexemes in a **non-divergent** pattern don't count toward the novelty cap (so a new sentence can carry them for free).
- Scheduling: an `fm` of a transparent lexeme whose immediate check is right is created due on the 4 d rung instead of next day (FR-R2 exception). Wrong → normal next-day.
- A form used in a divergent pattern slot (e.g. the definite *orașul*) is never fast-tracked, even if its lexeme is transparent.

## Acceptance criteria

- [ ] Content: every lexeme reviewed; flags set per the rule above; list the transparent ones in the PR for the owner to skim.
- [ ] Validator rule and coverage counts; tests.
- [ ] Tests: novelty cap ignores transparent units in non-divergent patterns only; a right check on a transparent form → due ≥ 4 d; divergent slot forms never skip.
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
