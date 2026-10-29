# T09 · Content batch A: Stage 1, ~100 sentences

| | |
|---|---|
| **Phase** | 1 |
| **Depends on** | T02 |
| **Can run in parallel with** | T03, T04, T05, T06, T07, T08 |

## Owns (files you may create or change)

- `app/content/lexemes/*.json`
- `app/content/sentences/A1-standup.json`
- `app/content/sentences/A1-me.json`
- `app/content/sentences/A1-meta.json`
- `app/content/sentences/A1-table.json`
- `app/content/manifest.json`

## Read first (only these)

- PRD §1, §4.1 (FR-C2, C8), §6
- CONTENT_GUIDE (all)

## Goal

Enough Stage 1 content for the Phase 1 release criterion (≥100 sentences).

## Spec

- About 30 `standup`, 30 `me`, 20 `meta`, 20 `table` sentences, Stage 1 patterns only (CONTENT_GUIDE §6).
- Each Stage 1 pattern has ≥8 sentences and ≥6 distinct head lexemes. `perfect-compus` and `modal-sa-12` have ≥15 each.
- Order within each file follows the i+1 authoring rule (CONTENT_GUIDE §8.2). The seed sentences from T02 can be moved into these files (keep their ids).
- ≥1 transform on ≥60% of sentences (only ops whose patterns are Stage 1: `negate`, `affirm`, `person:*`, `tense:pres>perf`, `tense:perf>pres`, `modal:*`, `question`).
- Glue tokens (*am, n-am, să, nu*) are `cloze: true` in ≥1 of every 5 sentences per glue pattern.
- High-frequency irregulars (*fi, avea, vrea, putea, face, merge, ști, lua, da, sta*) carry full present paradigms in `forms` (PRD Q2 default).

## Acceptance criteria

- [ ] Validator passes; counts above are verified by a short script in the PR description (or by the coverage report if T22 exists).
- [ ] The PR lists every lexeme's paradigm source (Dexonline) and any uncertain sentences.
- [ ] A self-review pass checked naturalness: no calques from English or French (e.g. prefer *are sens* over the anglicism *face sens*; note judgment calls).
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

Other situations (T17).
