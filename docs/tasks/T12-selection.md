# T12 · i+1 selection engine

| | |
|---|---|
| **Phase** | 2 |
| **Depends on** | T08, T11 |
| **Can run in parallel with** | T14, T15, T16, T17 |

## Owns (files you may create or change)

- `app/js/core/select.js`
- `app/js/core/session.js` (use select when available)
- `test/select.test.mjs`

## Read first (only these)

- PRD §3 (P-2, P-9), §4.4 (FR-S5)
- ARCHITECTURE §6

## Goal

The core of the product: new sentences that add exactly one thing, drawn toward what the learner already knows.

## Spec

Implement ARCHITECTURE §6.2 exactly, with an injected `rng`.
- Replace the FR-S4 interim order in `session.js` with `pickNewSentences` (keep the interim function for the cold-start fallback when select returns no candidates and there's no focus).
- When `blocked`, `session.js` returns `{ blocked, suggest }` so the UI can show "To unlock more here, first practice: X".

## Acceptance criteria

- [ ] **Cross-prioritization test (PRD Phase 2 criterion):** a fixture where *a mânca* is known from `table` and the focus is `perfect-compus` → the first pick is the *am mâncat* sentence.
- [ ] **Situation focus test:** a new situation picks a sentence whose only unknown is a word, not a pattern.
- [ ] **Invariant property test:** over 200 random states, no returned sentence has novelty 0 or > 2.
- [ ] The blocked path returns a sensible suggestion in a fixture.
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

UI for lists and focus (T13).
