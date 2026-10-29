# T21 · Session summary and export reminder

| | |
|---|---|
| **Phase** | 3 |
| **Depends on** | T11 |
| **Can run in parallel with** | T18, T19, T20, T22, T23 |

## Owns (files you may create or change)

- `app/js/ui/views/summary.js`
- `app/js/ui/views/session.js` (navigate to summary)
- `app/js/main.js` (export reminder banner)

## Read first (only these)

- PRD §4.5 (FR-P6), §4.7 (FR-X4)

## Goal

Make each session's gains visible, and protect progress.

## Spec

- Summary: cards done, new sentences, forms produced (distinct units correct this session), and **pattern state changes** (diff `allPatternStates` before and after; e.g. "perfect-compus: seen → producing"). Buttons: Home, One more Quick.
- Export reminder: banner when `lastExportAt` is null (after the 3rd session) or > 14 days old, with an Export action. Update `lastExportAt` on export.

## Acceptance criteria

- [ ] Summary state-change diff is unit-tested as a pure helper.
- [ ] The banner appears and disappears per the rules (test with a fixture `now`).
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.
