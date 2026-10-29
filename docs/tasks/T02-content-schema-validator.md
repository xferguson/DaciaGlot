# T02 · Content loader, validator, seed content

| | |
|---|---|
| **Phase** | 1 |
| **Depends on** | none |
| **Can run in parallel with** | T01, T03, T04, T05, T06 |

## Owns (files you may create or change)

- `app/content/manifest.json`
- `app/content/patterns.json`
- `app/content/lexemes/core.json`
- `app/content/sentences/A1-seed.json`
- `app/js/data/content.js`
- `scripts/validate-content.mjs`
- `test/content.test.mjs`
- `test/validate.test.mjs`

## Read first (only these)

- PRD §4.1 (FR-C1…C4, C6, C7)
- ARCHITECTURE §2
- CONTENT_GUIDE §1–§4, §6 (Stage 1–2 tables)

## Goal

Make content a validated, loadable data layer, so content tasks and engine tasks can proceed independently.

## Spec

- `patterns.json`: every Stage 1 and 2 pattern from CONTENT_GUIDE §6, with `requires`, `stage`, `level`, `slotLabel`, `minLexemesForProducing`.
- `lexemes/core.json` + `sentences/A1-seed.json`: **10 seed sentences** (standup ×3, me ×3, meta ×2, table ×2), fully tokenized per CONTENT_GUIDE §2.3. They must include at least one clitic-cluster token (*n-am*) and one transform each. Include the `aux-perf` and `nu` lexemes modeled per §2.1.
- `content.js`: `loadContent(baseUrl)` fetches the manifest and then all listed packs (`Promise.all`), drops `retired`, and builds the Maps in ARCHITECTURE §2. Keep the pure indexing in an exported `indexContent(raw)` so Node tests can call it without `fetch`.
- `validate-content.mjs`: implements **every error rule 1–10** in CONTENT_GUIDE §4, plus the warnings. Rule 11 (sw.js precache) is skipped with a notice if `app/sw.js` doesn't exist yet. It prints `file:id: message` and exits 1 on errors. Core checks are exported for tests. A `--coverage` flag can be stubbed until T22.
- Tests: `indexContent` on the seed content; the validator catches a fixture for each rule (put small invalid fixtures in `test/fixtures/`).

## Acceptance criteria

- [ ] `node scripts/validate-content.mjs` passes on the seed content and fails (exit 1) on each invalid fixture.
- [ ] `node --test test/` passes.
- [ ] CI (`deploy-pages.yml` check job) runs the validator; confirm in the PR checks.
- [ ] The seed sentences are linguistically correct (forms checked on Dexonline, noted in the PR).
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

The 100-sentence batch (T09); coverage report (T22).
