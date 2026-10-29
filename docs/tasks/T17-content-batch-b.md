# T17 · Content batch B: to ~300 sentences, all situations

| | |
|---|---|
| **Phase** | 2 |
| **Depends on** | T09 |
| **Can run in parallel with** | T11, T12, T13, T14, T15, T16 |

## Owns (files you may create or change)

- `app/content/**`

## Read first (only these)

- PRD §4.1 (FR-C6, C8), §6
- CONTENT_GUIDE (all)

## Goal

Complete Stage 1, start Stage 2, and seed every situation.

## Spec

- Add about 200 sentences: complete the Stage 1 coverage targets for `decisions`, `coaching`, `domain`, `getting-to-know`, `news` (≥10 each), then Stage 2 patterns across all situations (≥10 sentences per Stage 2 pattern so far, ≥6 head lexemes each).
- `getting-to-know` focuses on colleagues' hometowns, local foods, customs and hobbies, phrased as curious personal questions and answers (*De unde ești? Ce mâncare e specifică acolo? Ce-ți place cel mai mult la Cluj?*). Note that *Ce-ți place* uses a dative clitic, so it's Stage 2 (`clitic-dat`). Keep Stage 1 versions clitic-free.
- Every new sentence has ≥1 transform where a Stage-appropriate op exists. Introduce the `add-obj:*`, `add-dat:*`, `plural`, `definite` and `tense:pres>fut` ops with Stage 2 patterns.

## Acceptance criteria

- [ ] Validator passes; counts verified in the PR (≥300 total; each situation ≥10).
- [ ] Each Stage 2 pattern has a prerequisite path from Stage 1 sentences (no orphan patterns).
- [ ] Paradigm sources and uncertainties listed in the PR.
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

Stage 3+ (Phase 4).
