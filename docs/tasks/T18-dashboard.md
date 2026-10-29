# T18 · Progress dashboard

| | |
|---|---|
| **Phase** | 3 |
| **Depends on** | T11, T19 |
| **Can run in parallel with** | T20, T21, T22, T23 |

## Owns (files you may create or change)

- `app/js/ui/views/dashboard.js`
- `app/js/ui/components/ring.js`
- `app/js/ui/components/chart.js`
- `app/css/app.css` (dashboard styles)

## Read first (only these)

- PRD §3 (P-6), §4.5 (FR-P5, P7)
- ARCHITECTURE §7

## Goal

Show progress as production capability, organized by CEFR.

## Spec

Sections in FR-P5 order:
- Level rings (`levelProgress` per level present, with a breakdown on tap).
- Patterns grid (stage rows; chip color by state; tap → accuracy trend over the last 8 weeks from attempts + example sentences).
- Can-do checklist (from T19).
- Production stats (distinct `<lex>.<form>` units with ≥1 correct attempt, all-time and this week; sentences mastered; words known beside them).
- A weekly history bar chart (forms produced, minutes) and a 14-day due forecast.

Charts are inline SVG with no library. Colors come from tokens and work in both themes; label the axes. Home's level-ring placeholder becomes the real current level ring.

## Acceptance criteria

- [ ] Renders from a synthetic 3-month fixture state without errors and in < 100 ms (measure in the PR).
- [ ] Numbers match the `mastery.js` outputs for the fixture.
- [ ] Readable at a 360 px width in light and dark modes.
- [ ] `node --test test/` and `node scripts/validate-content.mjs` (once it exists) pass; `docs/STATUS.md` updated.

## Out of scope

Export of charts.
