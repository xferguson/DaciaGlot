# Q02 · Characterization tests for the card and session views

| | |
|---|---|
| **Track** | Code quality (Q) · see [the Q overview](Q00-code-quality-overview.md) |
| **Depends on** | none |
| **Can run in parallel with** | Q03, Q06, Q07, Q16, Q17 |

## Owns (files you may create or change)

- `test/helpers/fake-dom.mjs` (extend)
- `test/views-*.test.mjs` (new)
- `test/no-auto-advance.test.mjs` (may fold into the new tests)

## Read first (only these)

- CLAUDE.md · Ground rules
- ARCHITECTURE §3 Cards, §8 Sessions
- `app/js/ui/views/session.js`, `app/js/ui/views/card-*.js`, `app/js/ui/components/{answer-mode,feedback,button}.js` (to see what they call on the DOM)

## Goal

No test runs a card view or the session view, so wiring bugs ship (Q01, #83–#87). Lock in what the views do **today** so Q05, Q08, Q13, Q14 and Q15 can rewrite them safely.

## Spec

- Extend `fake-dom.mjs` just enough for the views: `innerHTML` (a tiny parser for the markup the views write: tags, `class`, `data-*`, `lang`, `role`, `aria-*`), `querySelector`/`querySelectorAll` for tag, `.class`, `[data-x]` and `tag.class` selectors, `classList`, `dataset`, `replaceWith`, `value`, `readOnly`, `select()`. No dependencies.
- Use `test/helpers/mini-content.mjs` for content and a fake `ctx` (`{state, content, store: {save, flush}, tts: {speak(){}} , navigate}`) that records calls.
- **Each card view** (`lr`, `cz` incl. `check`/`blanks`, `kf`, `xf`, `sb`, `er`, paradigm): assert the exact `onResult` payload for right first time, right after a retry, wrong twice, hint used, speak/self-grade (`er`/`xf`/`sb`), tiles; and that nothing advances without a tap.
- **Session view**: a queue reaches the summary; Hard/Again requeues once then lands on the difficult list; a mid-session claim skips its `fm`; a wrong immediate check is asked once more at the end; leaving mid-session runs `keepStarted` + `recordSession` and saves once more.
- Do not change any `app/` file. If a view can't be driven without a change, note it in the PR for Q05/Q08.

## Acceptance criteria

- [ ] Every card type and the five session flows above have at least one test.
- [ ] Deleting the pace import from `session.js` makes a new test fail (checked locally, not committed).
- [ ] No behavior change: every existing test passes unchanged (any test edit is an import-path move only, and the PR says so).
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. STATUS updated.
