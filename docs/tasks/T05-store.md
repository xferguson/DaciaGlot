# T05 · Persistence: store, migrations, export/import

| | |
|---|---|
| **Phase** | 1 |
| **Depends on** | none |
| **Can run in parallel with** | T01, T02, T03, T04, T06 |

## Owns (files you may create or change)

- `app/js/data/store.js`
- `app/js/data/migrations.js`
- `test/store.test.mjs`
- `test/helpers/local-storage-shim.mjs`

## Read first (only these)

- PRD §4.7 (FR-X1…X4), §5 (NFR-2, NFR-6)
- ARCHITECTURE §4 (all)

## Goal

Reliable local persistence that never silently loses progress.

## Spec

Implement the ARCHITECTURE §4.4 API.
- `defaultState(now)` holds every field with its documented default.
- Corruption: on a JSON parse failure or a missing `schemaVersion`, copy the raw string to `dg:v1:state.corrupt-<ts>`, return `defaultState`, and set `state._recovered = true` (not persisted) so the UI can show a banner.
- Quota: catch `QuotaExceededError` on save and invoke an `onQuotaError` callback registered via `store.onError(fn)`.
- Merge import: cards keep the later `lastReview`. Attempts are a union deduplicated by `card+t+u`. `seenSentences` keeps the min timestamp. `history` takes the per-day max of each field. `flags` and `canDoChecked` are unions. Settings keep the current device's values.
- Validate import shape: reject unknown `schemaVersion` > current with a clear `ImportError`.
- NFR-2 test: synthesize 600 sentences × 5 cards plus 90 days × 150 attempts/day and assert the serialized size is < 2 MB.

## Acceptance criteria

- [ ] Round-trip: export → `importState(replace)` yields a deep-equal state.
- [ ] Merge semantics covered by tests for each field.
- [ ] The corrupt-state test proves the backup key is written and the app state is fresh.
- [ ] Size test passes.
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

UI for export/import (T08 adds it to Settings).
