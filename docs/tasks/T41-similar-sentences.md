# T41 · Near-identical sentences are siblings

| | |
|---|---|
| **Phase** | 3.7 |
| **Depends on** | none |
| **Can run in parallel with** | T37, T38 (and later T39, T40, T42) |
| **Experiment** | [EXP-12](../EXPERIMENTS.md#exp-12--credit-what-you-already-know--t38t42) |

## Owns (files you may create or change)

- `app/js/core/similar.js` (new, pure): `sentenceOverlap`, `similarGroups` (built once per content index)
- `app/js/data/content.js` or `app/js/core/families.js` index step: add `content.similarOf: Map<sentenceId, string[]>`. Pick one place and keep it to one line in the index builder.
- `app/js/core/due.js`: `cardKeys` adds a `g:<group>` key. `burySiblings` and `spaceOut` then treat similar sentences like siblings with no further change.
- `test/similar.test.mjs` (new), `test/session-golden.test.mjs` fixture (regenerate if the queue changes, and say why)
- `app/sw.js` precache + version, `app/js/version.js`
- `docs/PRD.md` FR-S11; `docs/ARCHITECTURE.md` §2, §8; `docs/EXPERIMENTS.md` EXP-12

## Read first (only these)

- `docs/EXPERIMENTS.md` · Check-in 2026-11-04 and EXP-12
- PRD FR-S11, FR-R5; ARCHITECTURE §2, §8 (`cardKeys`, `burySiblings`, `spaceOut`)

## Goal

*Vreau o bere* and *Vreau o cafea* shouldn't be tested back to back: answering the first primes the second. Today only the same sentence, the same tested lexeme or the same family counts as related. Anki only buries cards from the same note. We go one step further, to near-duplicates.

## Spec

- `sentenceOverlap(a, b, content)` = Jaccard overlap of the two sentences' **non-trivial lexemes**.
- Two sentences are **similar** when the overlap is ≥ 0.5 and each has ≥ 2 non-trivial lexemes.
- `similarGroups(content)` unions similar pairs into groups (union-find, deterministic by id).
  - Groups larger than 12 are split by id order, so one hub sentence can't link everything.
- `cardKeys` adds `g:<groupId>` for a card's sentence, and for an `fm` card its `from` sentence.
  - The existing `burySiblings` (one due card per key per session) and `spaceOut` (≥ 2 apart) then handle similar sentences.
- New sentences are unaffected (`new` key logic unchanged).

## Acceptance criteria

- [ ] Tests:
  - The overlap maths.
  - The threshold and the minimum lexeme count.
  - Grouping is deterministic.
  - Hub splitting.
  - `burySiblings` keeps one of two similar due cards.
- [ ] `node scripts/validate-content.mjs --coverage` (or a test) prints the group count for the real content, and the PR description notes it.
- [ ] `node --test`, `node scripts/validate-content.mjs` and `node scripts/lint.mjs` pass. STATUS updated.
