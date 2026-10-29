# T13 · Situations / Patterns lists, Focus mode, lexeme detail

| | |
|---|---|
| **Phase** | 2 |
| **Depends on** | T11, T12 |
| **Can run in parallel with** | T14, T15, T16, T17 |

## Owns (files you may create or change)

- `app/js/ui/views/lists.js`
- `app/js/ui/views/lexeme.js`
- `app/js/ui/views/home.js` (tabs)
- `app/js/ui/views/session.js` (focus param)

## Read first (only these)

- PRD §3 (P-9), §4.4 (FR-S8), §4.6 (FR-N1, N2, N4)
- ARCHITECTURE §6.2, §7

## Goal

Let the learner choose what to study, by situation or by pattern, with live readiness.

## Spec

- Home gets tabs **Situations | Patterns**. Each row shows the name, a state chip or mastery bar, and "N ready" (the count of i+1-eligible sentences, computed with `pickNewSentences(∞, {focus})` and memoized per render). Patterns are grouped by stage; patterns with unmet prerequisites are dimmed and show "needs X".
- Tapping a row goes to `#/session?mode=focus&type=pattern&id=…`. Focus applies to new picks and due ordering (FR-S8). A blocked result shows the suggestion with a button to start that focus instead.
- Lexeme detail (`#/lexeme/:id`), reachable by tapping any token on a card after answering: lemma, gloss, key forms with unit-state dots, and the sentences you've seen containing it.

## Acceptance criteria

- [ ] Choosing a pattern runs a session whose new sentences all carry that pattern.
- [ ] The 'N ready' counts match `select.js` output for a fixture state (unit test the count helper).
- [ ] Works one-handed at a 360 px width.
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

Dashboard (T18).
