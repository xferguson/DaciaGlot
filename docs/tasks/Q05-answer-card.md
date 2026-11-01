# Q05 · One typed-answer card controller: `answerCard`

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | Q02 |
| **Can run in parallel with** | Q08, Q13, Q09 |

## Owns (files you may create or change)

- `app/js/ui/components/answer-card.js` (new)
- `app/js/core/check.js` (`hintFor` moves here)
- `app/js/ui/views/card-{enro,transform,slot,keyform,cloze}.js`
- `test/views-*.test.mjs` (only to follow moved imports)
- `test/answer-card.test.mjs` (new)
- `app/sw.js` precache + `APP_VERSION`, `app/js/version.js` (bump on any shell change; list new files)

## Read first (only these)

- ARCHITECTURE §5 Answer checking
- PRD FR-D6, FR-D7, FR-D8 (retry and hint rules)
- `app/js/ui/components/{answer-mode,feedback,button}.js`

## Goal

`card-enro`, `card-transform` and `card-slot` are about 80% the same: the same `mount`/`check`/`finish` state machine, the same "Not quite. Try once more." retry, the same `canRate = result !== "wrong" && attempts === 1 && !usedHint`. `hintFor` is copied verbatim into three views, and `card-slot.js` imports it from `card-transform.js`.

## Spec

- Pure core: `hintFor(input, expected, accept)` moves to `core/check.js`. Add a pure reducer `answerStep(state, event) → {state, effect}` (events: `check`, `hint`, `spoke`, `mode`; effects: `retry`, `finish`, `none`) in `answer-card.js` or `core/answer.js`, tested without a DOM.
- `answerCard(root, {header, expected, accept, avoid, sentence, content, speak, settings, onResult, onSetting, extras})` renders the shared slots and wires `mountAnswer`, `renderFeedback`, `nextButtons`.
- `card-enro`, `card-transform`, `card-slot` become thin: their header markup plus `answerCard`. `card-keyform` and `card-cloze` use the reducer and `hintFor` even where their layout differs.
- Re-export `hintFor` from `card-cloze.js` for one release if a test imports it there.

## Acceptance criteria

- [ ] `grep -rn "function hintFor" app/js` finds only `core/check.js`.
- [ ] Each of the three thin card files is under 50 lines.
- [ ] Q02's card tests pass unchanged.
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
