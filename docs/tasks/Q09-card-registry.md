# Q09 · Card-type registry and id helpers

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | Q04, Q10 |
| **Can run in parallel with** | Q05, Q08, Q13 |

## Owns (files you may create or change)

- `app/js/core/cards.js`, `app/js/core/units.js`, `app/js/core/session.js` (id handling only)
- `app/js/core/carrier.js`, `app/js/data/migrations.js` (id handling only)
- `app/js/ui/views/session.js`, `app/js/ui/components/feedback.js` (id parsing only)
- `test/cards.test.mjs`, `test/units.test.mjs`
- `docs/ARCHITECTURE.md` §3
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- ARCHITECTURE §3 Cards, §6.1 Units

## Goal

Card-type knowledge is spread over `parseCardId`, an `if` chain in `isUnlocked`, `DRILL_WEIGHT`, the session view's `RENDERERS`, and about twenty raw string checks: `id.startsWith("fm:")`, `id.slice(3)`, `` `lr:${from}` ``, `` `pg:${…}` `` (not a known type, so `parseCardId` throws on it). The unit id `` `${u.lex}.${u.form}` `` is built inline about a dozen times and parsed by hand with `indexOf(".")`.

## Spec

- `units.js`: `unitId(u)` and `parseUnitId(id) → {lex, form}`; replace every inline build and parse.
- `cards.js`: `buildCardId`/`parseCardId` are the only way to make or read a card id. Add `pg` as a known type (queue-only; never stored). Add `CARD_SPEC = { lr: {unlocked, …}, fm: …, … }` and make `isUnlocked`, `pickPerSentence` and the unit lookup use it instead of branching.
- If Q16 has landed, shrink its raw-prefix allowlist to zero.

## Acceptance criteria

- [ ] `grep -rnE 'startsWith\("(lr|fm|cz|kf|xf|sb|er|pg):"\)' app/js` finds nothing.
- [ ] Adding a card type means one `CARD_SPEC` entry plus a renderer (say so in ARCHITECTURE §3).
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
