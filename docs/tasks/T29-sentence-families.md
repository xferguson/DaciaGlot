# T29 · Sentence families: paradigm batch + one random probe

| | |
|---|---|
| **Phase** | 3.5 |
| **Depends on** | T25, T26 |
| **Can run in parallel with** | T27, T28, T30 |
| **Experiment** | [EXP-05](../EXPERIMENTS.md#exp-05--sentence-families-as-paradigms--t29) |

## Owns (files you may create or change)

- `app/js/core/families.js` (new), `test/families.test.mjs` (new)
- `app/js/data/content.js` (build `content.families` at load)
- `app/js/core/select.js`, `app/js/core/session.js`, `app/js/core/carrier.js`
- `app/js/ui/views/card-paradigm.js` (new), `app/js/ui/views/session.js`
- `scripts/validate-content.mjs` (coverage report: a families table)
- `app/sw.js`, `app/js/version.js`
- `docs/ARCHITECTURE.md` §2, §3, §6, §8 (**contract change**)

## Read first (only these)

- PRD §4.4 (FR-S5, S7), §4.8 (FR-R5)
- ARCHITECTURE §2, §6, §8
- `docs/tasks/T25-per-form-schedule.md`, `docs/tasks/T26-learn-today-test-tomorrow.md`
- `docs/EXPERIMENTS.md` · EXP-05

## Goal

*Locuiește / Locuiești / Locuiesc în Cluj* are one thing to learn: the person/number choice. Introduce such sentences together as a paradigm once. After that, review **one random member** at a time, so the learner has to pick the form instead of recognizing a repeat.

## Spec

- **Detection** (`families.js`, pure; `findFamilies(content) → Map<familyId, sentenceId[]>`, plus `content.familyOf: Map<sid, familyId>`):
  - Two sentences are siblings when, after dropping subject-pronoun tokens (a fixed list: *eu, tu, el, ea, noi, voi, ei, ele, dumneavoastră*), they have the same token count, and every differing token pair shares a lexeme but differs in form. At least one pair must differ.
  - A family is a connected component, capped at 6 (the 6 closest by id if larger).
- **Selection:** when `pickNewSentences` picks a sentence with unseen siblings, it brings in up to 2 siblings with it (up to 3 members). Together they count as one new sentence toward `newPerSession`.
- **Paradigm card** (`pg:<familyId>`, not stored in `state.cards`, presentation only):
  - shows the members as a table: Romanian, the differing form highlighted with its form label, and the English;
  - every row has audio;
  - it marks every member as seen (as `lr` does).
  - It replaces the members' `lr` cards. The immediate check (T26) then covers the new forms of **one random member**. The other members' new forms get `fm` cards due the next day without a check.
- **Review:**
  - When several due `fm` cards belong to forms that differ only within one family, show one at random per session and bury the rest (like T26's siblings).
  - `pickCarrier` for such a form prefers a random family member over other sentences.
- **Coverage report:** list each family with its members, so authors can spot wrong groupings.

## Acceptance criteria

- [ ] Tests: detection groups *El locuiește în Cluj / Locuiești în Cluj / Locuiesc în Cluj* and doesn't group sentences differing in lexeme.
- [ ] Tests: selection brings in siblings as one new unit; paradigm card marks all seen; one immediate check.
- [ ] Tests: at most one due card per family per session; the carrier is a family member.
- [ ] The coverage report prints families; the validator still passes on current content.
- [ ] Headless run: a paradigm card renders on a phone-width viewport in light and dark mode.
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. `docs/STATUS.md` updated. EXP-05 is `live since <merge date>`.
