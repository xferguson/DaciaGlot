# T28 · "I can produce this" claims

| | |
|---|---|
| **Phase** | 3.5 |
| **Depends on** | T25 |
| **Can run in parallel with** | T26, T27, T29, T30 |
| **Experiment** | [EXP-04](../EXPERIMENTS.md#exp-04--i-can-produce-this-claims--t28) |

## Owns (files you may create or change)

- `app/js/core/units.js` (`isKnown`), `app/js/core/session.js` (`claimForm`, `unclaimForm`; due filtering), `app/js/core/mastery.js`
- `app/js/data/store.js`, `app/js/data/migrations.js` (default `claimed: {}`)
- `app/js/ui/components/feedback.js`, `app/js/ui/views/lexeme.js`
- `test/units.test.mjs`, `test/session.test.mjs`, `test/mastery.test.mjs`, `test/store.test.mjs`
- `app/css/app.css` (sheet styles, if needed), `app/js/version.js`, `app/sw.js`
- `docs/ARCHITECTURE.md` §4, §6.1, §7.2 (**contract change**)

## Read first (only these)

- PRD §4.6, §4.8 (FR-R4)
- ARCHITECTURE §4, §6.1, §7.2
- `docs/tasks/T25-per-form-schedule.md`
- `docs/EXPERIMENTS.md` · Discovery interview and EXP-04

## Goal

Let the owner say "I can produce this exact form", so it's never tested. This is the only way trivial blanks are removed (the owner chose no automatic content skipping).

## Spec

- **State:** `AppState.claimed: Record<string, number>`, mapping a lexeme-form unit id (`locui.pres3sg`) to the ts it was claimed. The default `{}` is added by a migration or a load default. The claim is per **form**. Other forms of the lexeme stay separate.
- **Pure helpers** (`core/session.js`): `claimForm(state, unit, now)` and `unclaimForm(state, unit, now)` return a new state. Unclaim leaves any `fm` card where it was (suspended, then active again). Claiming a form with no `fm` creates none.
- **Effects of a claim:**
  - its `fm` card is excluded from `dueCards`;
  - it is never blanked in an immediate check (T26);
  - `isKnown` returns true;
  - mastery §7.2 treats it as `stable`, and the dashboard counts it as known.
  - It is **trusted fully**: no verification card. The only way back is an EN→RO miss (T27, "evidence wins") or an unclaim.
- **UI · feedback:** each Romanian token chip in feedback (`partsFor`) gets a tap action. A small sheet shows the form, the lemma, the gloss and the form label, with buttons **I can produce this** and **Open word page**. Tap targets are 44 px. The word link that exists today moves into the sheet.
- **UI · word page** (`#/lexeme/:id`): each form row shows "Claimed ✓ · Undo", or "I can produce this".
- The automatic `isKnown` rules (other form known; `trivial`) are unchanged. They only drive selection.

## Acceptance criteria

- [ ] Tests: claim/unclaim are pure; a claimed unit's `fm` is not due; unclaiming restores it with its old schedule.
- [ ] Tests: `isKnown` and mastery honour claims; claims are per form (`locui.pres3sg` claimed ≠ `locui.pres1sg`).
- [ ] Tests: export/import round-trips `claimed`; an old state loads with `claimed: {}`.
- [ ] Headless run: claim from feedback; the form disappears from the next session; undo on the word page.
- [ ] `node --test` and `node scripts/validate-content.mjs` pass. `docs/STATUS.md` updated. EXP-04 is `live since <merge date>`.
