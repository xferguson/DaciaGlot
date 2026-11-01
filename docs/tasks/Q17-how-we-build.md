# Q17 · Write down how we build

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | none |
| **Can run in parallel with** | everything (docs only) |

## Owns (files you may create or change)

- `CLAUDE.md` (a short "How we build" section)
- `docs/ARCHITECTURE.md` §1 (shared modules list)

## Read first (only these)

- CLAUDE.md
- ARCHITECTURE §1

## Goal

Agents keep re-writing helpers that exist and putting logic in views, because nothing tells them where shared code lives. Make the conventions explicit so each new task follows them.

## Spec

Add, in plain words and under ~25 lines:
1. **Shared modules:** `core/time.js` (Q03), `core/history.js` (Q04), `core/random.js` (Q06), `units.js` id helpers (Q09), `ui/dom.js` (Q07), `ui/components/button.js` (#87), `ui/components/answer-card.js` (Q05). Search them before writing a helper; mark the ones not merged yet as "(coming in Qxx)" and drop the marker as they land.
2. Card and unit ids only through `buildCardId`/`parseCardId`/`unitId`.
3. Views hold no logic: render a model, call `ctx.update(coreTransition)`, never import another view.
4. Every view change gets a fake-DOM test; every bug fix starts with a failing test.
5. A new card type is one `CARD_SPEC` entry plus a renderer built on `answerCard`.
6. `node scripts/lint.mjs` is part of the pre-PR checks.

## Acceptance criteria

- [ ] The section exists and every module it names either exists or is marked with its Q task.
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
